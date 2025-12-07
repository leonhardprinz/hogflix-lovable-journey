import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { log } from '../_shared/posthog-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { videoId } = await req.json();
    
    console.log('📝 Generating summary for video:', videoId);
    
    // Validate input
    if (!videoId) {
      await log.warn('Summary request missing videoId', { function_name: 'generate-video-summary' });
      return new Response(
        JSON.stringify({ error: 'videoId is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OTLP Log: Request started
    await log.info('Summary generation started', {
      video_id: videoId,
      function_name: 'generate-video-summary'
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch video details
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, title, description, ai_summary')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('❌ Video fetch error:', videoError);
      await log.error('Video not found', {
        video_id: videoId,
        error_message: videoError?.message || 'Not found',
        function_name: 'generate-video-summary'
      });
      return new Response(
        JSON.stringify({ error: 'Video not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if summary already exists
    if (video.ai_summary) {
      console.log('✅ Using cached summary');
      const latency = Date.now() - startTime;
      
      // OTLP Log: Cache hit
      await log.info('Summary cache hit', {
        video_id: videoId,
        video_title: video.title,
        latency_ms: latency,
        cached: true,
        summary_length: video.ai_summary.length,
        function_name: 'generate-video-summary'
      });
      
      return new Response(
        JSON.stringify({ summary: video.ai_summary, cached: true }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI to generate summary
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      await log.error('LOVABLE_API_KEY not configured', { function_name: 'generate-video-summary' });
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Summarize this video in 2-3 concise sentences. Focus on the key information and main takeaways.

Title: ${video.title}
Description: ${video.description || 'No description available'}

Provide a clear, engaging summary that helps viewers understand what this video is about.`;

    console.log('🤖 Calling Lovable AI...');
    const aiStartTime = Date.now();
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that creates concise, engaging video summaries.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiLatency = Date.now() - aiStartTime;

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Lovable AI error:', aiResponse.status, errorText);
      
      // OTLP Log: AI error
      await log.error('Lovable AI error', {
        video_id: videoId,
        http_status: aiResponse.status,
        error_message: errorText.substring(0, 200),
        ai_latency_ms: aiLatency,
        function_name: 'generate-video-summary',
        model: 'google/gemini-2.5-flash'
      });
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content;

    if (!summary) {
      await log.error('No summary in AI response', {
        video_id: videoId,
        function_name: 'generate-video-summary'
      });
      throw new Error('No summary generated');
    }

    console.log('✅ Summary generated:', summary.substring(0, 100) + '...');

    // Save summary to database
    const { error: updateError } = await supabase
      .from('videos')
      .update({ ai_summary: summary })
      .eq('id', videoId);

    if (updateError) {
      console.error('⚠️ Failed to save summary:', updateError);
      await log.warn('Failed to save summary to DB', {
        video_id: videoId,
        error_message: updateError.message,
        function_name: 'generate-video-summary'
      });
      // Still return the summary even if save fails
    } else {
      console.log('✅ Summary saved to database');
    }
    
    const totalLatency = Date.now() - startTime;

    // OTLP Log: Success
    await log.info('Summary generated successfully', {
      video_id: videoId,
      video_title: video.title,
      latency_ms: totalLatency,
      ai_latency_ms: aiLatency,
      cached: false,
      summary_length: summary.length,
      function_name: 'generate-video-summary',
      model: 'google/gemini-2.5-flash'
    });
    
    return new Response(
      JSON.stringify({ summary, cached: false }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const totalLatency = Date.now() - startTime;
    console.error('❌ Edge function error:', error);
    
    // OTLP Log: Unhandled error
    await log.error('Summary generation unhandled error', {
      error_message: error instanceof Error ? error.message : 'Unknown error',
      latency_ms: totalLatency,
      function_name: 'generate-video-summary'
    });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
