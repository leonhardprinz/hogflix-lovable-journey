import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, userId, profileId } = await req.json();
    console.log('FlixBuddy chat request:', { conversationId, userId, profileId, messageLength: message?.length });
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables');
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

    const systemPrompt = `You are FlixBuddy, the AI assistant for HogFlix streaming service. Your role is to help users discover movies and series that match their preferences.

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

Always be helpful and engaging while focusing on the available content.`;

    // Build conversation history for REST API format
    const conversationHistory = messages?.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })) || [];

    // Structure contents based on conversation state
    let contents;
    
    if (conversationHistory.length === 0) {
      // First message: combine system prompt with user message to avoid consecutive user roles
      console.log('First message - combining system prompt with user message');
      contents = [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }]
        }
      ];
    } else {
      // Subsequent messages: use existing history + new message (history already has proper alternation)
      console.log('Continuing conversation - using history');
      contents = [
        ...conversationHistory,
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ];
    }

    // Log contents structure for debugging
    console.log('Contents structure:', JSON.stringify(
      contents.map(c => ({ 
        role: c.role, 
        textLength: c.parts[0].text.length 
      })), 
      null, 
      2
    ));

    // Track LLM request start
    const requestStartTime = Date.now();

    // Call Gemini REST API directly
    console.log('Calling Gemini API with model: gemini-1.5-flash');
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini API response received');

    // Parse response
    const assistantMessage = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    console.log('Assistant message length:', assistantMessage.length);
    
    // Calculate latency in seconds
    const latencySeconds = (Date.now() - requestStartTime) / 1000;
    const tokenUsage = geminiData.usageMetadata || {};

    console.log('Token usage:', { 
      promptTokens: tokenUsage.promptTokenCount, 
      completionTokens: tokenUsage.candidatesTokenCount,
      latency: latencySeconds 
    });

    // Send $ai_generation event to PostHog via HTTP API
    const posthogEvent = {
      api_key: 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
      event: '$ai_generation',
      properties: {
        distinct_id: userId || 'anonymous',
        $ai_trace_id: conversationId,
        $ai_model: 'gemini-1.5-flash',
        $ai_provider: 'google',
        $ai_input: contents.map(msg => ({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.parts.map(p => ({ type: 'text', text: p.text }))
        })),
        $ai_input_tokens: tokenUsage.promptTokenCount || 0,
        $ai_output_choices: [{
          role: 'assistant',
          content: [{ type: 'text', text: assistantMessage }]
        }],
        $ai_output_tokens: tokenUsage.candidatesTokenCount || 0,
        $ai_latency: latencySeconds,
        $ai_temperature: 0.8,
        $ai_max_tokens: 1024,
        // Custom properties
        conversationId,
        profileId,
        messageLength: message.length,
      }
    };

    console.log('Sending event to PostHog...');
    
    // Send to PostHog HTTP API (non-blocking)
    fetch('https://eu.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posthogEvent)
    }).then(res => {
      console.log('PostHog event sent, status:', res.status);
    }).catch(err => {
      console.error('PostHog event failed:', err);
    });

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
          model: 'gemini-1.5-flash',
          timestamp: new Date().toISOString()
        }
      });

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify({
      message: assistantMessage,
      conversationId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in flixbuddy-chat function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});