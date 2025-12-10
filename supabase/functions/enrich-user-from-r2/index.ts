import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CDP properties to set on PostHog person
const CDP_PROPERTIES = [
  'customer_health_score',
  'lifetime_value',
  'is_vip',
  'power_user_tier',
  'videos_watched_external',
  'subscription_months'
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, distinct_id } = await req.json();
    
    console.log(`[enrich-user-from-r2] Received webhook for email: ${email}, distinct_id: ${distinct_id}`);

    if (!email) {
      console.error('[enrich-user-from-r2] Missing email in payload');
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!distinct_id) {
      console.error('[enrich-user-from-r2] Missing distinct_id in payload');
      return new Response(
        JSON.stringify({ error: 'distinct_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const personalApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
    const projectId = Deno.env.get('POSTHOG_PROJECT_ID');
    const posthogApiKey = Deno.env.get('POSTHOG_API_KEY');

    if (!personalApiKey || !projectId || !posthogApiKey) {
      console.error('[enrich-user-from-r2] Missing PostHog configuration:', { 
        hasPersonalApiKey: !!personalApiKey, 
        hasProjectId: !!projectId,
        hasApiKey: !!posthogApiKey
      });
      return new Response(
        JSON.stringify({ error: 'PostHog configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Query R2 data via HogQL
    console.log(`[enrich-user-from-r2] Querying R2 for email: ${email}`);
    
    const hogqlQuery = {
      kind: "HogQLQuery",
      query: `
        SELECT 
          email,
          is_vip,
          customer_health_score,
          power_user_tier,
          lifetime_value,
          videos_watched_external,
          subscription_months
        FROM hogflix_demo_r2_bucket
        WHERE email = '${email.toLowerCase()}'
        LIMIT 1
      `
    };

    const r2Response = await fetch(
      `https://eu.i.posthog.com/api/projects/${projectId}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${personalApiKey}`
        },
        body: JSON.stringify({ query: hogqlQuery })
      }
    );

    if (!r2Response.ok) {
      const errorText = await r2Response.text();
      console.error('[enrich-user-from-r2] HogQL query failed:', r2Response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to query R2 data', details: errorText }),
        { status: r2Response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const r2Data = await r2Response.json();
    console.log('[enrich-user-from-r2] R2 query response:', JSON.stringify(r2Data, null, 2));

    // Check if we have data
    if (!r2Data.results || r2Data.results.length === 0) {
      console.log(`[enrich-user-from-r2] No R2 data found for email: ${email}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No R2 data found for this email',
          email 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the R2 data
    const row = r2Data.results[0];
    const cdpData = {
      email: row[0],
      is_vip: row[1],
      customer_health_score: row[2],
      power_user_tier: row[3],
      lifetime_value: row[4],
      videos_watched_external: row[5],
      subscription_months: row[6],
    };

    console.log('[enrich-user-from-r2] Parsed CDP data:', cdpData);

    // Step 2: Update person properties via Capture API
    console.log(`[enrich-user-from-r2] Updating PostHog person properties for distinct_id: ${distinct_id}`);

    const capturePayload = {
      api_key: posthogApiKey,
      distinct_id: distinct_id,
      event: '$set',
      properties: {
        $set: {
          customer_health_score: cdpData.customer_health_score,
          lifetime_value: cdpData.lifetime_value,
          is_vip: cdpData.is_vip,
          power_user_tier: cdpData.power_user_tier,
          videos_watched_external: cdpData.videos_watched_external,
          subscription_months: cdpData.subscription_months,
          cdp_enriched_at: new Date().toISOString(),
          cdp_source: 'r2_bucket'
        }
      },
      timestamp: new Date().toISOString()
    };

    const captureResponse = await fetch('https://eu.i.posthog.com/capture/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(capturePayload)
    });

    if (!captureResponse.ok) {
      const errorText = await captureResponse.text();
      console.error('[enrich-user-from-r2] Capture API failed:', captureResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to update person properties', details: errorText }),
        { status: captureResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[enrich-user-from-r2] ✅ Successfully enriched user ${email} (${distinct_id}) with CDP data`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User enriched with CDP data',
        email,
        distinct_id,
        properties_set: CDP_PROPERTIES,
        cdp_data: cdpData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[enrich-user-from-r2] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to enrich user', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
