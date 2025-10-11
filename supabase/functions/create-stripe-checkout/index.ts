import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.25.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRICE_IDS: { [key: string]: string } = {
  'standard': 'price_1SGd5qDNddzVHEi1cntbi8TE',
  'premium': 'price_1SGd68DNddzVHEi16V2xWiaH'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating Stripe checkout session...');

    // Get authenticated user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error('User not authenticated or email not available');
    }

    console.log('User authenticated:', user.id, user.email);

    // Get plan name from request
    const { plan_name } = await req.json();
    console.log('Plan requested:', plan_name);

    if (!plan_name || !PRICE_IDS[plan_name]) {
      throw new Error(`Invalid plan name: ${plan_name}`);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Create checkout session with metadata
    const origin = req.headers.get('origin') || 'http://localhost:8080';
    
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price: PRICE_IDS[plan_name],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/checkout-success?plan=${plan_name}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        user_id: user.id,
        plan_name: plan_name,
      },
    });

    console.log('Checkout session created:', session.id);
    console.log('Metadata attached:', { user_id: user.id, plan_name });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
