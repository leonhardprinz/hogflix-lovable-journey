import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { email } = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const personalApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
    const projectId = Deno.env.get('POSTHOG_PROJECT_ID');

    if (!personalApiKey || !projectId) {
      console.error('Missing PostHog configuration:', { 
        hasApiKey: !!personalApiKey, 
        hasProjectId: !!projectId 
      });
      return new Response(
        JSON.stringify({ error: 'PostHog configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Querying R2 data for email: ${email}`);

    // HogQL query to fetch data from R2 bucket
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

    console.log('Executing HogQL query:', hogqlQuery.query);

    const response = await fetch(
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PostHog API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to query PostHog SQL API', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('PostHog response:', JSON.stringify(data, null, 2));

    // Extract first row from results
    if (data.results && data.results.length > 0) {
      const row = data.results[0];
      // Map columns to values based on HogQL response structure
      // Columns order: email, is_vip, customer_health_score, power_user_tier, lifetime_value, videos_watched_external, subscription_months
      const result = {
        email: row[0],
        is_vip: row[1],
        customer_health_score: row[2],
        power_user_tier: row[3],
        lifetime_value: row[4],
        videos_watched_external: row[5],
        subscription_months: row[6],
      };

      console.log('✅ R2 data fetched successfully:', result);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('No data found for email:', email);
    return new Response(
      JSON.stringify({ error: 'No data found for this email in R2 bucket' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error querying R2 data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to query R2 data', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
