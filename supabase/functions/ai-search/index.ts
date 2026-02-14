import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { log } from '../_shared/posthog-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { query } = await req.json();

    if (!query) {
      await log.warn('AI search missing query', { function_name: 'ai-search' });
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // OTLP Log: Request started
    await log.info('AI search started', {
      query_text: query.substring(0, 100),
      query_length: query.length,
      function_name: 'ai-search'
    });

    // Get Gemini API key from secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      await log.error('GEMINI_API_KEY not configured', { function_name: 'ai-search' });
      return new Response(
        JSON.stringify({ error: 'AI service configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, get all available video titles from the database
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('title, description');

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      await log.error('Database error fetching videos', {
        error_message: videosError.message,
        function_name: 'ai-search'
      });
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const videoCount = videos?.length || 0;

    // Create the prompt for Gemini
    const videoTitles = videos?.map(v => v.title).join(', ') || '';
    const prompt = `You are a movie recommendation expert. Based on the user's query: "${query}", analyze their intent and recommend movies from our video database.

Available movies in our database: ${videoTitles}

Instructions:
1. Understand what the user is looking for (genre, mood, specific themes, etc.)
2. From the available movies listed above, select the ones that best match their query
3. Return ONLY a JSON array of exact movie titles that match their request
4. If no movies match perfectly, select the closest alternatives
5. Return maximum 5 recommendations
6. The response must be valid JSON format: ["Title 1", "Title 2", "Title 3"]

User query: ${query}

Response:`;

    // Model fallback chain: newest → most capable
    const MODELS = [
      'gemini-3.0-flash',    // Primary: latest, fastest
      'gemini-2.5-flash',    // Fallback 1: proven, fast
      'gemini-2.5-pro',      // Fallback 2: most capable
    ];

    // Make API call to Gemini with fallback
    const aiStartTime = Date.now();

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      },
    });

    let geminiResponse: Response | null = null;
    let modelUsed = MODELS[0];

    for (const model of MODELS) {
      modelUsed = model;
      console.log(`Trying model: ${model}`);

      try {
        geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
          }
        );

        if (geminiResponse.ok) {
          console.log(`Model ${model} succeeded`);
          break;
        }

        const errorText = await geminiResponse.text();
        console.warn(`Model ${model} failed (${geminiResponse.status}): ${errorText.substring(0, 200)}`);
        geminiResponse = null;
      } catch (fetchError) {
        console.error(`Model ${model} fetch error:`, fetchError);
        geminiResponse = null;
      }
    }

    const aiLatency = Date.now() - aiStartTime;

    if (!geminiResponse || !geminiResponse.ok) {
      await log.error('All Gemini models failed', {
        query_text: query.substring(0, 100),
        ai_latency_ms: aiLatency,
        function_name: 'ai-search',
        models_tried: MODELS.join(', ')
      });

      // Track error in PostHog
      const posthogApiKey = Deno.env.get('POSTHOG_API_KEY');
      if (posthogApiKey) {
        try {
          await fetch('https://eu.i.posthog.com/i/v0/e/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: posthogApiKey,
              event: '$ai_generation',
              properties: {
                distinct_id: 'ai-search-system',
                $ai_model: modelUsed,
                $ai_provider: 'google',
                $ai_input: query,
                $ai_latency: aiLatency / 1000,
                $ai_is_error: true,
                $ai_http_status: geminiResponse?.status || 0,
              },
              timestamp: new Date().toISOString()
            })
          });
        } catch (_) { /* ignore tracking errors */ }
      }

      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response:', geminiData);

    // Extract token usage for PostHog LLM Analytics
    const usageMetadata = geminiData.usageMetadata || {};
    const tokenUsage = {
      input: usageMetadata.promptTokenCount || 0,
      output: usageMetadata.candidatesTokenCount || 0,
      total: usageMetadata.totalTokenCount || 0
    };

    // Parse Gemini response
    let recommendedTitles: string[] = [];
    let usedFallback = false;

    try {
      const aiResponse = geminiData.candidates[0].content.parts[0].text;
      console.log('AI response text:', aiResponse);

      // Extract JSON from the response
      const jsonMatch = aiResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        recommendedTitles = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: if no JSON format, try to extract titles manually
        console.log('No JSON found, using fallback parsing');
        recommendedTitles = videos?.slice(0, 3).map(v => v.title) || [];
        usedFallback = true;
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      // Fallback to first few videos if parsing fails
      recommendedTitles = videos?.slice(0, 3).map(v => v.title) || [];
      usedFallback = true;

      await log.warn('AI response parse error, using fallback', {
        query_text: query.substring(0, 100),
        error_message: parseError instanceof Error ? parseError.message : 'Parse error',
        function_name: 'ai-search'
      });
    }

    console.log('Recommended titles:', recommendedTitles);

    // Query the database for full video details
    const { data: recommendedVideos, error: queryError } = await supabase
      .from('videos')
      .select('*')
      .in('title', recommendedTitles);

    if (queryError) {
      console.error('Error querying recommended videos:', queryError);
      await log.error('Database error fetching recommendations', {
        error_message: queryError.message,
        function_name: 'ai-search'
      });
      return new Response(
        JSON.stringify({ error: 'Database query error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sort results to match the order from AI recommendations
    const sortedVideos = recommendedTitles.map(title =>
      recommendedVideos?.find(video => video.title === title)
    ).filter(Boolean);

    console.log('Final sorted videos:', sortedVideos);

    const totalLatency = Date.now() - startTime;

    // OTLP Log: Success
    await log.info('AI search completed', {
      query_text: query.substring(0, 100),
      results_count: sortedVideos.length,
      video_pool_size: videoCount,
      latency_ms: totalLatency,
      ai_latency_ms: aiLatency,
      used_fallback: usedFallback,
      function_name: 'ai-search',
      model: modelUsed
    });

    // Track successful $ai_generation in PostHog for LLM Analytics
    const posthogApiKey = Deno.env.get('POSTHOG_API_KEY');
    if (posthogApiKey) {
      try {
        const inputCost = (tokenUsage.input / 1_000_000) * 0.075;
        const outputCost = (tokenUsage.output / 1_000_000) * 0.30;
        await fetch('https://eu.i.posthog.com/i/v0/e/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: posthogApiKey,
            event: '$ai_generation',
            properties: {
              distinct_id: 'ai-search-system',
              $ai_model: modelUsed,
              $ai_provider: 'google',
              $ai_input: query,
              $ai_output_choices: [recommendedTitles.join(', ')],
              $ai_input_tokens: tokenUsage.input,
              $ai_output_tokens: tokenUsage.output,
              $ai_total_cost_usd: inputCost + outputCost,
              $ai_latency: aiLatency / 1000,
              $ai_trace_id: `ai-search-${Date.now()}`,
              $ai_http_status: 200,
              $ai_is_error: false,
            },
            timestamp: new Date().toISOString()
          })
        });
      } catch (_) { /* ignore tracking errors */ }
    }

    return new Response(
      JSON.stringify({
        videos: sortedVideos,
        query: query,
        aiRecommendations: recommendedTitles
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const totalLatency = Date.now() - startTime;
    console.error('Error in ai-search function:', error);

    // OTLP Log: Unhandled error
    await log.error('AI search unhandled error', {
      error_message: error instanceof Error ? error.message : 'Unknown error',
      latency_ms: totalLatency,
      function_name: 'ai-search'
    });

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
