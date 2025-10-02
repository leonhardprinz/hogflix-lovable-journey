import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';
import { PostHog } from 'https://esm.sh/posthog-node@4.2.1';

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
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Initialize PostHog for LLM analytics
    const posthog = new PostHog(
      'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
      { host: 'https://eu.i.posthog.com' }
    );

    // Initialize Gemini with PostHog tracking
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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

    // Build conversation context
    const conversationHistory = messages?.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })) || [];

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

    // Add current user message
    conversationHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Track LLM request start with PostHog
    const requestStartTime = Date.now();
    posthog.capture({
      distinctId: userId || 'anonymous',
      event: 'llm_request_started',
      properties: {
        conversationId,
        profileId,
        model: 'gemini-1.5-flash',
        messageLength: message.length,
      }
    });

    // Call Gemini API with PostHog tracking
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }]
        },
        ...conversationHistory
      ],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    const response = result.response;
    const assistantMessage = response.text() || 'Sorry, I could not generate a response.';
    
    // Track LLM request completion with PostHog
    const responseTime = Date.now() - requestStartTime;
    const tokenUsage = response.usageMetadata || {};
    
    posthog.capture({
      distinctId: userId || 'anonymous',
      event: 'llm_request_completed',
      properties: {
        conversationId,
        profileId,
        model: 'gemini-1.5-flash',
        responseTime,
        promptTokens: tokenUsage.promptTokenCount || 0,
        completionTokens: tokenUsage.candidatesTokenCount || 0,
        totalTokens: tokenUsage.totalTokenCount || 0,
        responseLength: assistantMessage.length,
      }
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

    // Flush PostHog events
    await posthog.shutdown();

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      conversationId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in flixbuddy-chat function:', error);
    
    // Track LLM request failure with PostHog if available
    try {
      const posthog = new PostHog(
        'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
        { host: 'https://eu.i.posthog.com' }
      );
      posthog.capture({
        distinctId: 'system',
        event: 'llm_request_failed',
        properties: {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      });
      await posthog.shutdown();
    } catch (phError) {
      console.error('Failed to track error in PostHog:', phError);
    }
    
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});