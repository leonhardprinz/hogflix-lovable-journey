import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  analysis: any;
  pageName: string;
  pageUrl: string;
  personaType?: string;
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
    const { analysis, pageName, pageUrl, personaType = 'general' }: GenerateRequest = await req.json();
    
    console.log(`[PHASE 4] Generating behaviors for: ${pageName}, persona: ${personaType}`);
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Build prompt for behavior generation
    const prompt = buildBehaviorPrompt(analysis, pageName, pageUrl, personaType);

    const MODEL_PRIORITY = [
      'gemini-2.0-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash-lite',
      'gemini-2.5-flash',
    ];

    const { response, modelUsed } = await callGeminiWithRetry(
      GEMINI_API_KEY,
      MODEL_PRIORITY,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        }
      }
    );

    console.log(`[PHASE 4] Used model: ${modelUsed} for behavior generation`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PHASE 4] Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const behaviorText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!behaviorText) {
      throw new Error('No behaviors returned from Gemini');
    }

    console.log('[PHASE 4] Behavior generation completed');

    // Parse and validate the generated behaviors
    const behaviors = parseBehaviorResponse(behaviorText);
    const validatedBehaviors = validateBehaviors(behaviors);

    return new Response(
      JSON.stringify({
        success: true,
        pageName,
        pageUrl,
        personaType,
        behaviors: validatedBehaviors,
        modelUsed,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[PHASE 4] Error in generate-synthetic-behaviors:', error);
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

function buildBehaviorPrompt(
  analysis: any,
  pageName: string,
  pageUrl: string,
  personaType: string
): string {
  return `You are a behavior generation expert for synthetic user traffic on a video streaming platform.

**Context:**
- Page: ${pageName}
- URL: ${pageUrl}
- Persona Type: ${personaType}
- Analysis: ${JSON.stringify(analysis, null, 2)}

**Your Task:**
Generate complete, executable Playwright code snippets for synthetic users to interact with the new elements found.

**Requirements:**
1. **Valid Playwright Code**: Must be syntactically correct TypeScript/JavaScript
2. **Error Handling**: Include try-catch for optional interactions
3. **Timing**: Add realistic delays (waitForTimeout)
4. **Selectors**: Use the most reliable selector strategy
5. **Event Tracking**: Include PostHog event capture after interaction
6. **Conditional Logic**: Check feature flags or state before interacting

**Persona Characteristics:**
- ${personaType === 'active' ? 'ACTIVE: Engages with most features, high probability interactions' : ''}
- ${personaType === 'casual' ? 'CASUAL: Selective interactions, medium probability' : ''}
- ${personaType === 'power' ? 'POWER: Explores advanced features, tries everything' : ''}
- ${personaType === 'general' ? 'GENERAL: Balanced behavior across all user types' : ''}

**Output Format (JSON only, no markdown):**
{
  "behaviors": [
    {
      "behaviorId": "unique_id_snake_case",
      "name": "Human-readable behavior name",
      "description": "What this behavior does",
      "targetElement": "button[data-testid='ai-summary']",
      "triggerCondition": "hasEarlyAccess && videoWatched > 80",
      "baseProbability": 0.35,
      "personaAdjustments": {
        "active": 0.45,
        "casual": 0.25,
        "power": 0.60
      },
      "playwrightCode": "try {\\n  if (getFeatureFlag(p, 'early_access_ai_summaries')) {\\n    await page.click('button[data-testid=\\"ai-summary\\"]');\\n    await page.waitForTimeout(1500);\\n    console.log('  ✓ Clicked AI summary');\\n  }\\n} catch (e) {\\n  if (DEBUG) console.log('  ! AI summary not found');\\n}",
      "posthogEvent": {
        "eventName": "ai_summary:opened",
        "properties": {
          "feature_flag": "early_access_ai_summaries",
          "persona_type": "{{persona_type}}",
          "is_synthetic": true
        }
      },
      "enabled": true,
      "confidence": 0.85
    }
  ]
}

**Critical Rules:**
- Use proper escaping in playwrightCode strings (\\n for newlines, \\" for quotes)
- Code must be copy-pasteable into existing journey scripts
- Always check if element exists before interaction
- Include meaningful console.log for debugging
- Event properties should use {{placeholders}} for runtime values

Return ONLY valid JSON, no markdown.`;
}

function parseBehaviorResponse(text: string): any {
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
    console.error('[PHASE 4] Failed to parse behavior response:', error);
    console.error('[PHASE 4] Raw text:', text);
    throw new Error('Invalid JSON response from Gemini');
  }
}

function validateBehaviors(data: any): any[] {
  if (!data.behaviors || !Array.isArray(data.behaviors)) {
    console.warn('[PHASE 4] No behaviors array found in response');
    return [];
  }

  return data.behaviors.filter((behavior: any) => {
    // Validate required fields
    const hasRequired = 
      behavior.behaviorId &&
      behavior.name &&
      behavior.targetElement &&
      behavior.playwrightCode &&
      typeof behavior.baseProbability === 'number';

    if (!hasRequired) {
      console.warn('[PHASE 4] Skipping invalid behavior:', behavior.behaviorId || 'unknown');
      return false;
    }

    // Validate probability range
    if (behavior.baseProbability < 0 || behavior.baseProbability > 1) {
      console.warn('[PHASE 4] Invalid probability for:', behavior.behaviorId);
      behavior.baseProbability = Math.max(0, Math.min(1, behavior.baseProbability));
    }

    // Basic syntax check for Playwright code
    if (!behavior.playwrightCode.includes('page.')) {
      console.warn('[PHASE 4] Suspicious Playwright code:', behavior.behaviorId);
      return false;
    }

    return true;
  });
}
