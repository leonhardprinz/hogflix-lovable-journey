import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    
    console.log('📝 Generating summary for video:', videoId);
    
    // Validate input
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      return new Response(
        JSON.stringify({ error: 'Video not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if summary already exists
    if (video.ai_summary) {
      console.log('✅ Using cached summary');
      return new Response(
        JSON.stringify({ summary: video.ai_summary, cached: true }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI to generate summary
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Summarize this video in 2-3 concise sentences. Focus on the key information and main takeaways.

Title: ${video.title}
Description: ${video.description || 'No description available'}

Provide a clear, engaging summary that helps viewers understand what this video is about.`;

    console.log('🤖 Calling Lovable AI...');
    
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Lovable AI error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content;

    if (!summary) {
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
      // Still return the summary even if save fails
    } else {
      console.log('✅ Summary saved to database');
    }
    
    return new Response(
      JSON.stringify({ summary, cached: false }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
