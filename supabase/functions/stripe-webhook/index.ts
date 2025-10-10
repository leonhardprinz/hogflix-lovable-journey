import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.25.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!signature || !webhookSecret || !stripeSecretKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get the raw body for signature verification
    const body = await req.text();
    
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      console.log('Webhook verified:', event.type);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        // Extract metadata from the session
        const userId = session.metadata?.user_id;
        const planName = session.metadata?.plan_name;
        const paymentIntent = session.payment_intent as string;

        if (!userId || !planName) {
          console.error('Missing required metadata in checkout session');
          break;
        }

        console.log(`Processing subscription for user ${userId}, plan: ${planName}`);

        // Get the subscription plan from database
        const { data: planData, error: planError } = await supabaseClient
          .from('subscription_plans')
          .select('id')
          .eq('name', planName)
          .single();

        if (planError || !planData) {
          console.error('Failed to find subscription plan:', planError);
          break;
        }

        // Update or create user subscription
        const { error: subscriptionError } = await supabaseClient
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_id: planData.id,
            status: 'active',
            payment_intent: paymentIntent,
            started_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (subscriptionError) {
          console.error('Failed to update subscription:', subscriptionError);
        } else {
          console.log('Subscription activated successfully for user:', userId);
        }

        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated/deleted:', subscription.id);

        // Handle subscription changes (upgrade, downgrade, cancellation)
        const userId = subscription.metadata?.user_id;
        
        if (userId) {
          const newStatus = subscription.status === 'active' ? 'active' : 'cancelled';
          
          await supabaseClient
            .from('user_subscriptions')
            .update({
              status: newStatus,
              expires_at: subscription.cancel_at 
                ? new Date(subscription.cancel_at * 1000).toISOString() 
                : null,
            })
            .eq('user_id', userId);

          console.log(`Updated subscription status to ${newStatus} for user:`, userId);
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);
        
        // You can handle failed payments here (e.g., send notification)
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
