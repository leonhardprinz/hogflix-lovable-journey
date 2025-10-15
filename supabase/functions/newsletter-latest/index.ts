import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-newsletter-token, content-type",
  "Content-Type": "application/json; charset=utf-8",
};

serve(async (req) => {
  console.log(`[newsletter-latest] ${req.method} request received`);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Optional token protection
    const expectedToken = Deno.env.get("NEWSLETTER_TOKEN");
    if (expectedToken) {
      const providedToken = req.headers.get("X-Newsletter-Token");
      if (providedToken !== expectedToken) {
        console.error("[newsletter-latest] Unauthorized: Invalid or missing token");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      console.log("[newsletter-latest] Token validated successfully");
    }

    // Parse limit parameter (default 6, max 20)
    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "6", 10) || 6,
      20
    );
    console.log(`[newsletter-latest] Fetching ${limit} latest public videos`);

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Query videos with new columns
    const { data, error } = await supabase
      .from("videos")
      .select("id, title, slug, thumbnail_url, published_at, is_public")
      .eq("is_public", true)  // Only show public videos
      .order("published_at", { ascending: false })  // Latest first
      .limit(limit);

    if (error) {
      console.error("[newsletter-latest] Database error:", error);
      return new Response(
        JSON.stringify({ items: [], error: error.message }), 
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Map to format expected by PostHog email template
    const items = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.title ?? "Untitled",  // PostHog template expects "name"
      slug: row.slug ?? row.id,  // Use slug for clean URLs
      thumbnail_url: row.thumbnail_url ?? null,
    }));

    console.log(`[newsletter-latest] Successfully returning ${items.length} videos`);

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        "Cache-Control": "public, max-age=60, s-maxage=60"  // Cache for 1 minute
      },
    });

  } catch (error: any) {
    console.error("[newsletter-latest] Unexpected error:", error);
    return new Response(
      JSON.stringify({ items: [], error: error.message }), 
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
