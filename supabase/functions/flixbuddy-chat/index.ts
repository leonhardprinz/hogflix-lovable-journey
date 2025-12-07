import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { log } from '../_shared/posthog-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { message, conversationId, userId, profileId } = await req.json();
    console.log('FlixBuddy chat request:', { conversationId, userId, profileId, messageLength: message?.length });
    
    // OTLP Log: Request started
    await log.info('FlixBuddy request started', {
      conversation_id: conversationId || 'unknown',
      user_id: userId || 'anonymous',
      profile_id: profileId || 'unknown',
      message_length: message?.length || 0,
      function_name: 'flixbuddy-chat'
    });
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const POSTHOG_API_KEY = Deno.env.get('POSTHOG_API_KEY');

    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables');
      await log.error('Missing environment variables', { function_name: 'flixbuddy-chat' });
      throw new Error('Missing required environment variables');
    }

    console.log('Environment variables loaded successfully');

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

    // Get user's watchlist and ratings for personalization
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

    // Create system prompt with video context
    const videoContext = videos?.map(v => 
      `${v.title}: ${v.description || 'No description'} (${Math.floor(v.duration / 60)}min)`
    ).join('\n') || '';

    const watchlistIds = watchlist?.map(w => w.video_id) || [];
    const userRatings = ratings?.reduce((acc, r) => {
      acc[r.video_id] = r.rating;
      return acc;
    }, {} as Record<string, number>) || {};

    // Build conversation history as formatted text
    const conversationText = messages?.map(msg => 
      `${msg.role === 'user' ? 'User' : 'FlixBuddy'}: ${msg.content}`
    ).join('\n\n') || '';

    // Build a single prompt string with everything
    const fullPrompt = `You are FlixBuddy, the AI assistant for HogFlix streaming service. Your role is to help users discover movies and series that match their preferences.

AVAILABLE CONTENT:
${videoContext}

USER CONTEXT:
- User has ${watchlistIds.length} items in watchlist
- User has rated ${Object.keys(userRatings).length} videos
- Current profile: ${profileId}

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

Always be helpful and engaging while focusing on the available content.

CONVERSATION HISTORY:
${conversationText}

User: ${message}

FlixBuddy:`;

    console.log('Calling Gemini API with single prompt structure');
    
    // Track timing for analytics
    const aiStartTime = Date.now();
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const aiLatency = Date.now() - aiStartTime;
    const httpStatus = geminiResponse.status;

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', httpStatus, errorText);
      
      // OTLP Log: AI error
      await log.error('Gemini API error', {
        conversation_id: conversationId || 'unknown',
        http_status: httpStatus,
        error_message: errorText.substring(0, 200),
        latency_ms: aiLatency,
        function_name: 'flixbuddy-chat',
        model: 'gemini-2.0-flash'
      });
      
      // Track error in PostHog
      await capturePostHogEvent(
        POSTHOG_API_KEY || '',
        '$ai_generation',
        userId,
        {
          $ai_model: 'gemini-2.0-flash',
          $ai_provider: 'google',
          $ai_input: message,
          $ai_trace_id: conversationId,
          $ai_latency: aiLatency / 1000,
          $ai_http_status: httpStatus,
          $ai_is_error: true,
          error_message: errorText,
        }
      );

      if (httpStatus === 429) {
        await log.warn('Rate limit exceeded', {
          conversation_id: conversationId || 'unknown',
          function_name: 'flixbuddy-chat',
          model: 'gemini-2.0-flash'
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Please try again in a moment.',
            isRateLimit: true 
          }), 
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      throw new Error(`Gemini API error: ${httpStatus} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini API response received, latency:', aiLatency, 'ms');

    // Parse response
    const assistantMessage = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    console.log('Assistant message generated successfully, length:', assistantMessage.length);

    // Extract token usage for analytics
    const usageMetadata = geminiData.usageMetadata || {};
    const tokenUsage = {
      input: usageMetadata.promptTokenCount || 0,
      output: usageMetadata.candidatesTokenCount || 0,
      total: usageMetadata.totalTokenCount || 0
    };
    console.log('Token usage:', tokenUsage);

    // Calculate cost breakdown (Gemini 1.5 Flash pricing: $0.075 per 1M input, $0.30 per 1M output)
    const inputCost = (tokenUsage.input / 1_000_000) * 0.075;
    const outputCost = (tokenUsage.output / 1_000_000) * 0.30;
    const totalCost = inputCost + outputCost;

    const totalLatency = Date.now() - startTime;

    // OTLP Log: Successful response
    await log.info('FlixBuddy response generated', {
      conversation_id: conversationId || 'unknown',
      user_id: userId || 'anonymous',
      latency_ms: totalLatency,
      ai_latency_ms: aiLatency,
      tokens_input: tokenUsage.input,
      tokens_output: tokenUsage.output,
      tokens_total: tokenUsage.total,
      response_length: assistantMessage.length,
      model: 'gemini-2.0-flash',
      function_name: 'flixbuddy-chat',
      cost_usd_micro: Math.round(totalCost * 1_000_000) // microdollars for precision
    });

    // Capture successful AI generation in PostHog
    await capturePostHogEvent(
      POSTHOG_API_KEY || '',
      '$ai_generation',
      userId,
      {
        $ai_model: 'gemini-2.0-flash',
        $ai_provider: 'google',
        $ai_input: message,
        $ai_output_choices: [assistantMessage],
        $ai_input_tokens: tokenUsage.input,
        $ai_output_tokens: tokenUsage.output,
        $ai_total_cost_usd: totalCost,
        $ai_latency: aiLatency / 1000,
        $ai_trace_id: conversationId,
        $ai_http_status: httpStatus,
        $ai_is_error: false,
        profile_id: profileId,
      }
    );

    // Save user message
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message
      });

    // Save assistant message
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantMessage,
        metadata: {
          model: 'gemini-2.0-flash',
          timestamp: new Date().toISOString()
        }
      });

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify({
      message: assistantMessage,
      conversationId,
      metadata: {
        tokens: tokenUsage,
        latency: aiLatency,
        cost: {
          input: inputCost,
          output: outputCost,
          total: totalCost
        },
        model: 'gemini-2.0-flash'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalLatency = Date.now() - startTime;
    console.error('Error in flixbuddy-chat function:', error);
    
    // OTLP Log: Unhandled error
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
