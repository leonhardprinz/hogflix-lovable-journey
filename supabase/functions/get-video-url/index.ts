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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { videoId } = await req.json();

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Video ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating signed URL for video:', videoId);

    // First, check if there's an HLS asset available
    const { data: hlsAsset, error: hlsError } = await supabase
      .from('video_assets')
      .select('storage_bucket, path')
      .eq('video_id', videoId)
      .eq('asset_type', 'hls')
      .maybeSingle();

    if (hlsAsset && !hlsError) {
      console.log('Found HLS asset, generating signed URL for:', hlsAsset.path);
      
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from(hlsAsset.storage_bucket)
        .createSignedUrl(hlsAsset.path, 3600);

      if (urlError) {
        console.error('Error generating HLS signed URL:', urlError);
      } else {
        console.log('Successfully generated HLS signed URL');
        return new Response(
          JSON.stringify({ signedUrl: signedUrl.signedUrl, isHLS: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fallback to original video_url from videos table
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('video_url')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('Video not found:', videoError);
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL for the video file
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('videos')
      .createSignedUrl(video.video_url, 3600); // 1 hour expiry

    if (urlError) {
      console.error('Error generating signed URL:', urlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate video URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully generated signed URL');

    return new Response(
      JSON.stringify({ signedUrl: signedUrl.signedUrl, isHLS: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-video-url function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});