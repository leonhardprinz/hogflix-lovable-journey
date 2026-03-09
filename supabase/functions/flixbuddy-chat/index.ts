import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { log } from '../_shared/posthog-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── POSTHOG PROMPT FETCHER ──────────────────────────────────────────────────

const POSTHOG_PERSONAL_API_KEY = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
const promptCache: Record<string, { text: string; expiresAt: number }> = {};

async function fetchPrompt(promptKey: string, fallback: string): Promise<string> {
  const now = Date.now();
  if (promptCache[promptKey] && promptCache[promptKey].expiresAt > now) {
    return promptCache[promptKey].text;
  }
  if (!POSTHOG_PERSONAL_API_KEY) return fallback;
  try {
    const res = await fetch(
      `https://eu.posthog.com/api/environments/85924/llm_prompts/name/${promptKey}/`,
      { headers: { Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}` } }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const text: string = data.content ?? data.template ?? fallback;
    const compiled = text.replace(/\{\{platform_name\}\}/g, 'HogFlix');
    promptCache[promptKey] = { text: compiled, expiresAt: now + 5 * 60 * 1000 };
    return compiled;
  } catch {
    return fallback;
  }
}

// Helper to capture PostHog events via HTTP API (Deno compatible)
async function capturePostHogEvent(apiKey: string, event: string, distinctId: string, properties: Record<string, any>) {
  if (!apiKey) return;
  try {
    await fetch('https://eu.i.posthog.com/i/v0/e/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        properties: { distinct_id: distinctId, ...properties },
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('PostHog capture error:', err);
  }
}

// ─── MODEL CONFIGURATIONS ────────────────────────────────────────────────────

interface ModelConfig {
  id: string;
  label: string;
  provider: 'google' | 'mistral';
  apiModel: string;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'google',
    apiModel: 'gemini-2.0-flash',
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.40,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'google',
    apiModel: 'gemini-2.5-flash',
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    apiModel: 'gemini-2.5-pro',
    inputPricePer1M: 1.25,
    outputPricePer1M: 10.00,
  },
  'gemini-3.0-flash': {
    id: 'gemini-3.0-flash',
    label: 'Gemini 3.0 Flash',
    provider: 'google',
    apiModel: 'gemini-3.0-flash',
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.40,
  },
  'mistral-small-latest': {
    id: 'mistral-small-latest',
    label: 'Mistral Small',
    provider: 'mistral',
    apiModel: 'mistral-small-latest',
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.30,
  },
  'mistral-medium-latest': {
    id: 'mistral-medium-latest',
    label: 'Mistral Medium',
    provider: 'mistral',
    apiModel: 'mistral-medium-latest',
    inputPricePer1M: 2.50,
    outputPricePer1M: 7.50,
  },
  'mistral-large-latest': {
    id: 'mistral-large-latest',
    label: 'Mistral Large',
    provider: 'mistral',
    apiModel: 'mistral-large-latest',
    inputPricePer1M: 2.00,
    outputPricePer1M: 6.00,
  },
};

// Auto mode: fallback chain
const AUTO_FALLBACK_CHAIN = ['gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];

// ─── PROVIDER CALL FUNCTIONS ─────────────────────────────────────────────────

async function callGemini(apiKey: string, model: string, prompt: string): Promise<{ response: Response; modelUsed: string }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
      }),
    }
  );
  return { response, modelUsed: model };
}

function parseGeminiResponse(data: any): { text: string; tokens: { input: number; output: number; total: number } } {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
  const usage = data.usageMetadata || {};
  return {
    text,
    tokens: {
      input: usage.promptTokenCount || 0,
      output: usage.candidatesTokenCount || 0,
      total: usage.totalTokenCount || 0,
    },
  };
}

async function callMistral(apiKey: string, model: string, prompt: string): Promise<{ response: Response; modelUsed: string }> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  return { response, modelUsed: model };
}

function parseMistralResponse(data: any): { text: string; tokens: { input: number; output: number; total: number } } {
  const text = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
  const usage = data.usage || {};
  return {
    text,
    tokens: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
      total: usage.total_tokens || 0,
    },
  };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { message, conversationId, userId, profileId, model: requestedModel, promptVariant, posthogSessionId } = await req.json();
    console.log('FlixBuddy chat request:', { conversationId, userId, profileId, requestedModel, messageLength: message?.length });

    await log.info('FlixBuddy request started', {
      conversation_id: conversationId || 'unknown',
      user_id: userId || 'anonymous',
      profile_id: profileId || 'unknown',
      message_length: message?.length || 0,
      requested_model: requestedModel || 'auto',
      function_name: 'flixbuddy-chat'
    });

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const POSTHOG_API_KEY = Deno.env.get('POSTHOG_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get conversation history
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // Get available videos for context
    const { data: videos } = await supabase
      .from('videos')
      .select('id, title, description, duration')
      .limit(50);

    // Get user's watchlist and ratings
    const { data: watchlist } = await supabase
      .from('user_watchlist')
      .select('video_id')
      .eq('user_id', userId)
      .eq('profile_id', profileId);

    const { data: ratings } = await supabase
      .from('video_ratings')
      .select('video_id, rating')
      .eq('user_id', userId)
      .eq('profile_id', profileId);

    const videoContext = videos?.map(v =>
      `${v.title}: ${v.description || 'No description'} (${Math.floor(v.duration / 60)}min)`
    ).join('\n') || '';

    const watchlistIds = watchlist?.map(w => w.video_id) || [];
    const userRatings = ratings?.reduce((acc, r) => {
      acc[r.video_id] = r.rating;
      return acc;
    }, {} as Record<string, number>) || {};

    const conversationText = messages?.map(msg =>
      `${msg.role === 'user' ? 'User' : 'FlixBuddy'}: ${msg.content}`
    ).join('\n\n') || '';

    // Fetch system prompt from PostHog Prompts based on A/B variant
    const PROMPT_FALLBACK = `You are FlixBuddy, the AI assistant for HogFlix streaming service. Your role is to help users discover movies and series that match their preferences.

INSTRUCTIONS:
1. Be conversational, friendly, and enthusiastic about movies/series
2. Ask follow-up questions to understand preferences (genre, mood, duration, etc.)
3. Recommend specific titles from the available content
4. Explain why you're recommending specific content based on user preferences
5. Keep responses concise but engaging
6. If recommending multiple titles, prioritize variety in genres/styles
7. Consider the user's previous ratings and watchlist when making recommendations

RESPONSE FORMAT:
When recommending content, structure your response like this:
"Based on what you're looking for, I'd recommend:

🎬 **[Title 1]** - [Brief reason why it matches their request]
🎬 **[Title 2]** - [Brief reason why it matches their request]

Would you like more details about any of these, or should I look for something different?"

Always be helpful and engaging while focusing on the available content.`;

    const promptKey = promptVariant === 'funny' ? 'flixbuddy-funny' : 'flixbuddy-system-prompt';
    const systemPrompt = await fetchPrompt(promptKey, PROMPT_FALLBACK);

    const fullPrompt = `${systemPrompt}

AVAILABLE CONTENT:
${videoContext}

USER CONTEXT:
- User has ${watchlistIds.length} items in watchlist
- User has rated ${Object.keys(userRatings).length} videos
- Current profile: ${profileId}

CONVERSATION HISTORY:
${conversationText}

User: ${message}

FlixBuddy:`;

    // ─── CALL THE SELECTED MODEL ─────────────────────────────────────────────

    const aiStartTime = Date.now();
    let responseText = '';
    let tokenUsage = { input: 0, output: 0, total: 0 };
    let modelUsed = requestedModel || 'auto';
    let providerUsed = 'google';
    let httpStatus = 200;

    const selectedConfig = requestedModel && requestedModel !== 'auto'
      ? MODEL_CONFIGS[requestedModel]
      : null;

    if (selectedConfig) {
      // ── SPECIFIC MODEL SELECTED ──
      console.log(`Using specific model: ${selectedConfig.id} (${selectedConfig.provider})`);
      providerUsed = selectedConfig.provider;

      let apiResponse: Response;

      if (selectedConfig.provider === 'mistral') {
        if (!MISTRAL_API_KEY) throw new Error('Mistral API key not configured');
        const result = await callMistral(MISTRAL_API_KEY, selectedConfig.apiModel, fullPrompt);
        apiResponse = result.response;
        modelUsed = result.modelUsed;
      } else {
        if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
        const result = await callGemini(GEMINI_API_KEY, selectedConfig.apiModel, fullPrompt);
        apiResponse = result.response;
        modelUsed = result.modelUsed;
      }

      httpStatus = apiResponse.status;

      if (apiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.', isRateLimit: true }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`${selectedConfig.provider} API error (${apiResponse.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await apiResponse.json();
      const parsed = selectedConfig.provider === 'mistral'
        ? parseMistralResponse(data)
        : parseGeminiResponse(data);

      responseText = parsed.text;
      tokenUsage = parsed.tokens;

    } else {
      // ── AUTO MODE: Gemini fallback chain ──
      console.log('Auto mode: trying Gemini fallback chain:', AUTO_FALLBACK_CHAIN);
      providerUsed = 'google';

      let geminiResponse: Response | null = null;

      for (const model of AUTO_FALLBACK_CHAIN) {
        modelUsed = model;
        console.log(`Trying model: ${model}`);

        try {
          if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
          const result = await callGemini(GEMINI_API_KEY, model, fullPrompt);
          geminiResponse = result.response;

          if (geminiResponse.ok) {
            console.log(`Model ${model} succeeded`);
            break;
          }

          const errorText = await geminiResponse.text();
          console.warn(`Model ${model} failed (${geminiResponse.status}): ${errorText.substring(0, 200)}`);

          if (geminiResponse.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.', isRateLimit: true }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          geminiResponse = null;
        } catch (fetchError) {
          console.error(`Model ${model} fetch error:`, fetchError);
          geminiResponse = null;
        }
      }

      if (!geminiResponse || !geminiResponse.ok) {
        httpStatus = geminiResponse?.status || 0;
        throw new Error(`All Gemini models failed after trying: ${AUTO_FALLBACK_CHAIN.join(', ')}`);
      }

      httpStatus = geminiResponse.status;
      const data = await geminiResponse.json();
      const parsed = parseGeminiResponse(data);
      responseText = parsed.text;
      tokenUsage = parsed.tokens;
    }

    const aiLatency = Date.now() - aiStartTime;
    const totalLatency = Date.now() - startTime;

    // Calculate cost
    const config = MODEL_CONFIGS[modelUsed] || MODEL_CONFIGS['gemini-2.0-flash'];
    const inputCost = (tokenUsage.input / 1_000_000) * config.inputPricePer1M;
    const outputCost = (tokenUsage.output / 1_000_000) * config.outputPricePer1M;
    const totalCost = inputCost + outputCost;

    console.log(`Response from ${providerUsed}/${modelUsed}, latency: ${aiLatency}ms, tokens: ${tokenUsage.total}`);

    await log.info('FlixBuddy response generated', {
      conversation_id: conversationId || 'unknown',
      user_id: userId || 'anonymous',
      latency_ms: totalLatency,
      ai_latency_ms: aiLatency,
      tokens_input: tokenUsage.input,
      tokens_output: tokenUsage.output,
      tokens_total: tokenUsage.total,
      response_length: responseText.length,
      model: modelUsed,
      provider: providerUsed,
      function_name: 'flixbuddy-chat',
      cost_usd_micro: Math.round(totalCost * 1_000_000)
    });

    // Capture PostHog AI generation
    await capturePostHogEvent(
      POSTHOG_API_KEY || '',
      '$ai_generation',
      userId,
      {
        $ai_model: modelUsed,
        $ai_provider: providerUsed,
        $ai_input: [{ role: 'user', content: message }],
        $ai_output_choices: [{ role: 'assistant', content: responseText }],
        $ai_input_tokens: tokenUsage.input,
        $ai_output_tokens: tokenUsage.output,
        $ai_total_cost_usd: totalCost,
        $ai_latency: aiLatency / 1000,
        $ai_trace_id: conversationId,
        $ai_http_status: httpStatus,
        $ai_is_error: false,
        $ai_prompt_name: promptKey,
        profile_id: profileId,
        ...(posthogSessionId ? { $session_id: posthogSessionId } : {}),
      }
    );

    // Save messages
    await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'user', content: message });
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: responseText,
      metadata: { model: modelUsed, provider: providerUsed, timestamp: new Date().toISOString() }
    });

    return new Response(JSON.stringify({
      message: responseText,
      conversationId,
      metadata: {
        tokens: tokenUsage,
        latency: aiLatency,
        cost: { input: inputCost, output: outputCost, total: totalCost },
        model: modelUsed,
        provider: providerUsed,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalLatency = Date.now() - startTime;
    console.error('Error in flixbuddy-chat function:', error);

    await log.error('FlixBuddy unhandled error', {
      error_message: error instanceof Error ? error.message : 'Unknown error',
      latency_ms: totalLatency,
      function_name: 'flixbuddy-chat'
    });

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
