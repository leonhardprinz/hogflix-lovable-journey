import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JourneyRequest {
  persona: any;
  currentPage: string;
  availableLinks: any[];
  visitedPages: string[];
  sessionGoal?: string;
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
    const { persona, currentPage, availableLinks, visitedPages, sessionGoal }: JourneyRequest = await req.json();

    console.log(`[ORGANIC] Generating journey for ${persona.distinct_id} at ${currentPage}`);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Build prompt for Gemini to decide next navigation
    const prompt = buildJourneyPrompt(persona, currentPage, availableLinks, visitedPages, sessionGoal);

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
          temperature: 0.8,
          maxOutputTokens: 2048,
        }
      }
    );

    console.log(`[ORGANIC] Used model: ${modelUsed} for journey decision`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ORGANIC] Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const journeyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!journeyText) {
      throw new Error('No journey decision returned from Gemini');
    }

    console.log('[ORGANIC] Journey decision generated');

    // Parse the decision
    const decision = parseJourneyDecision(journeyText);

    return new Response(
      JSON.stringify({
        success: true,
        decision,
        modelUsed,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[ORGANIC] Error in generate-organic-journey:', error);
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

function buildJourneyPrompt(
  persona: any,
  currentPage: string,
  availableLinks: any[],
  visitedPages: string[],
  sessionGoal?: string
): string {
  const goalText = sessionGoal || 'Explore platform';
  return `You are simulating a realistic user journey on a video streaming platform called HogFlix.

**Current Context:**
- User Type: ${persona.activity_pattern} (engagement: ${persona.engagement_score}/100)
- Current Page: ${currentPage}
- Session Goal: ${sessionGoal || 'Explore and discover content'}
- Pages Visited This Session: ${visitedPages.length} (${visitedPages.join(', ')})
- Total Sessions: ${persona.total_sessions}

**User Characteristics:**
- Plan: ${persona.plan}
- Lifecycle State: ${persona.state}
- Videos Watched: ${persona.videos_watched}
- Engagement Score: ${persona.engagement_score}

**Available Navigation Options:**
${availableLinks.map((link, i) => `${i + 1}. ${link.text} → ${link.href} (type: ${link.type})`).join('\n')}

**Your Task:**
Decide what this user would REALISTICALLY do next. Consider:

1. **User Intent**: What brought them here? What are they trying to accomplish?
2. **Natural Flow**: Real users don't click randomly - they follow their goals
3. **Exploration vs Goal**: Balance discovering new features with completing tasks
4. **Fatigue**: Users don't endlessly click - sessions have natural endpoints
5. **Persona Behavior**:
   - DAILY users: More exploration, try new features, longer sessions
   - CASUAL users: Quick visits, focused goals, fewer clicks
   - BINGE users: Video-focused, less navigation, more watching
   - POWER users: Explore everything, advanced features, settings

**Decision Options:**
A. Navigate to a specific link (choose which one and why)
B. Interact with page elements (scroll, search, filter)
C. End session (if goal met or user would naturally leave)

**Output Format (JSON only, no markdown):**
{
  "action": "navigate" | "interact" | "end",
  "target": "link_href or element_description",
  "reasoning": "Brief explanation of why user would do this",
  "confidence": 0.75,
  "estimatedDuration": 3000,
  "nextGoal": "What user will try to do on next page"
}

**Examples of Good Decisions:**
- New user on home → Navigate to /browse (explore catalog)
- Active user on browse → Navigate to video (watch content)
- User after watching → Navigate to /pricing (upgrade interest)
- Casual user after 3 pages → End session (satisfied)

Be realistic - not every session is long, not every user explores everything.`;
}

function parseJourneyDecision(text: string): any {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const decision = JSON.parse(cleaned);

    // Validate required fields
    if (!decision.action || !['navigate', 'interact', 'end'].includes(decision.action)) {
      throw new Error('Invalid action type');
    }

    // Set defaults
    decision.confidence = decision.confidence || 0.5;
    decision.estimatedDuration = decision.estimatedDuration || 2000;

    return decision;
  } catch (error) {
    console.error('[ORGANIC] Failed to parse decision:', error);
    console.error('[ORGANIC] Raw text:', text);

    // Fallback to end session
    return {
      action: 'end',
      reasoning: 'Unable to parse AI decision',
      confidence: 0.3,
      estimatedDuration: 0
    };
  }
}
