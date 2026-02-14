import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  pageUrl: string;
  pageHtml: string;
  pageName: string;
  existingBehaviors?: any[];
}

async function callGeminiWithRetry(
  apiKey: string,
  modelPriority: string[],
  body: any,
  maxRetries = 2
): Promise<{ response: Response; modelUsed: string }> {

  for (const model of modelPriority) {
    console.log(`[AI] Attempting with model: ${model}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }
        );

        if (response.ok) {
          console.log(`[AI] ✓ Success with ${model}`);
          return { response, modelUsed: model };
        }

        if (response.status === 429) {
          console.log(`[AI] ⚠️ Rate limited on ${model} (attempt ${attempt + 1}/${maxRetries})`);
          if (attempt === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          break;
        }

        if (response.status === 404) {
          console.log(`[AI] ⚠️ Model ${model} not found, trying next`);
          break;
        }

        const errorText = await response.text();
        console.error(`[AI] Error with ${model}:`, response.status, errorText);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));

      } catch (error) {
        console.error(`[AI] Network error with ${model}:`, error);
        if (attempt === maxRetries - 1) break;
      }
    }
  }

  throw new Error('All models exhausted - rate limits exceeded on all available models');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageUrl, pageHtml, pageName, existingBehaviors = [] }: AnalyzeRequest = await req.json();

    console.log(`[PHASE 4] Analyzing page structure for: ${pageName}`);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Extract interactive elements from HTML
    const interactiveElements = extractInteractiveElements(pageHtml);
    console.log(`[PHASE 4] Found ${interactiveElements.length} interactive elements`);

    // Build prompt for Gemini
    const prompt = buildAnalysisPrompt(pageName, pageUrl, interactiveElements, existingBehaviors);

    const MODEL_PRIORITY = [
      'gemini-3.0-flash',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ];

    const { response, modelUsed } = await callGeminiWithRetry(
      GEMINI_API_KEY,
      MODEL_PRIORITY,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      }
    );

    console.log(`[PHASE 4] Used model: ${modelUsed}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PHASE 4] Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      throw new Error('No analysis returned from Gemini');
    }

    console.log('[PHASE 4] Analysis completed successfully');

    // Parse the JSON response from Gemini
    const analysis = parseGeminiResponse(analysisText);

    return new Response(
      JSON.stringify({
        success: true,
        pageName,
        pageUrl,
        analysis,
        modelUsed,
        analyzedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[PHASE 4] Error in analyze-page-structure:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractInteractiveElements(html: string): any[] {
  const elements: any[] = [];

  // Match buttons with various attributes
  const buttonRegex = /<button[^>]*?(?:data-testid=["']([^"']+)["'])?[^>]*?(?:class=["']([^"']+)["'])?[^>]*?>([^<]*)<\/button>/gi;
  let match;

  while ((match = buttonRegex.exec(html)) !== null) {
    elements.push({
      type: 'button',
      testId: match[1] || null,
      classes: match[2] || null,
      text: match[3]?.trim() || null,
    });
  }

  // Match links
  const linkRegex = /<a[^>]*?href=["']([^"']+)["'][^>]*?>([^<]*)<\/a>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    elements.push({
      type: 'link',
      href: match[1],
      text: match[2]?.trim() || null,
    });
  }

  // Match inputs
  const inputRegex = /<input[^>]*?type=["']([^"']+)["'][^>]*?(?:placeholder=["']([^"']+)["'])?/gi;
  while ((match = inputRegex.exec(html)) !== null) {
    elements.push({
      type: 'input',
      inputType: match[1],
      placeholder: match[2] || null,
    });
  }

  // Match divs with role="button" or data-testid
  const divButtonRegex = /<div[^>]*?(?:role=["']button["']|data-testid=["']([^"']+)["'])[^>]*?>/gi;
  while ((match = divButtonRegex.exec(html)) !== null) {
    elements.push({
      type: 'interactive-div',
      testId: match[1] || null,
    });
  }

  return elements.slice(0, 50); // Limit to first 50 elements
}

function buildAnalysisPrompt(
  pageName: string,
  pageUrl: string,
  elements: any[],
  existingBehaviors: any[]
): string {
  return `You are analyzing a web page for a video streaming platform called HogFlix to generate realistic synthetic user behavior.

**Page Details:**
- Page Name: ${pageName}
- URL: ${pageUrl}
- Number of Interactive Elements: ${elements.length}

**Interactive Elements Found:**
${JSON.stringify(elements, null, 2)}

**Existing Behaviors (if any):**
${existingBehaviors.length > 0 ? JSON.stringify(existingBehaviors, null, 2) : 'None - this is first analysis'}

**Your Task:**
Analyze these elements and suggest NEW realistic user interactions that synthetic users should perform. Focus on:

1. **New Features**: Identify elements that weren't in existing behaviors
2. **User Intent**: What would a real user want to do with these elements?
3. **Interaction Patterns**: Click, type, hover, scroll behaviors
4. **Conditional Logic**: When should users interact (based on state, flags, etc.)
5. **Probability**: How likely is this interaction (0.0-1.0)

**Output Format (JSON only, no markdown):**
{
  "newElementsFound": [
    {
      "elementDescription": "AI summary toggle button",
      "selector": "button[data-testid='ai-summary-toggle']",
      "elementType": "button",
      "context": "Video detail page, below player",
      "suggestedInteraction": {
        "actionType": "click",
        "probability": 0.3,
        "condition": "hasEarlyAccess && videoCompleted",
        "playwrightCode": "await page.click('button[data-testid=\"ai-summary-toggle\"]')",
        "eventToTrack": "ai_summary:toggled",
        "eventProperties": {
          "has_early_access": true,
          "video_completed": true
        }
      }
    }
  ],
  "confidence": 0.85,
  "notes": "Brief explanation of the analysis"
}

**Important:**
- Only suggest interactions for NEW elements not in existing behaviors
- Be realistic - not all elements should be clicked every time
- Consider user personas (active, casual, power users)
- Return ONLY valid JSON, no markdown code blocks`;
}

function parseGeminiResponse(text: string): any {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[PHASE 4] Failed to parse Gemini response:', error);
    console.error('[PHASE 4] Raw text:', text);
    throw new Error('Invalid JSON response from Gemini');
  }
}
