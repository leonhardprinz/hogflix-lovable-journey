import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, ArrowRight, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';
import { usePostHog, useFeatureFlagEnabled } from 'posthog-js/react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRageClickDetection } from '@/hooks/useRageClickDetection';
import PricingTableLayout from '@/components/PricingTableLayout';
import { RetentionOfferModal } from '@/components/RetentionOfferModal';
import { landmarkProps } from '@/lib/demoErrors';
import { slog } from '@/lib/demoErrors';

const Pricing = () => {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [ctaVariant, setCtaVariant] = useState<string>('control');
  const [layoutVariant, setLayoutVariant] = useState<string | null>(null);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [pendingDowngradePlan, setPendingDowngradePlan] = useState<string | null>(null);
  const ultimateButtonFixed = useFeatureFlagEnabled('Ultimate_button_subscription_fix');
  const vipRetentionEnabled = useFeatureFlagEnabled('vip_retention_offer');

  const ultimateButtonRef = useRef<HTMLButtonElement>(null);
  const pageLoadTime = useRef(Date.now());

  // Rage click detection for Ultimate button
  useRageClickDetection(ultimateButtonRef, {
    threshold: 3,
    timeWindow: 2000,
    elementSelector: 'button.ultimate-subscribe-button'
  });

  useEffect(() => {
    document.title = "Pricing – HogFlix";

    // Track time on page when leaving
    return () => {
      const timeOnPage = Date.now() - pageLoadTime.current;
      posthog?.capture('pricing:time_on_page', {
        duration_ms: timeOnPage,
        duration_seconds: Math.round(timeOnPage / 1000),
        layout: layoutVariant || 'card'
      });
    };
  }, [posthog, layoutVariant]);

  useEffect(() => {
    // Load feature flag variants
    posthog?.onFeatureFlags(() => {
      // CTA experiment
      const ctaExperimentVariant = posthog.getFeatureFlag('pricing_upgrade_cta_experiment');
      if (ctaExperimentVariant && typeof ctaExperimentVariant === 'string') {
        setCtaVariant(ctaExperimentVariant);
      }

      // Layout experiment
      const pricingLayoutVariant = posthog.getFeatureFlag('pricing_page_layout_experiment');
      const variant = pricingLayoutVariant === 'table-layout' ? 'table-layout' : 'control';
      setLayoutVariant(variant);

      // Track experiment assignment
      posthog?.capture('experiment:pricing_layout_assigned', {
        variant: variant,
        user_plan: subscription?.plan_name || 'none',
        timestamp: new Date().toISOString()
      });

      // Track layout viewed
      posthog?.capture('pricing:layout_viewed', {
        layout: variant === 'table-layout' ? 'table' : 'card',
        user_plan: subscription?.plan_name || 'none'
      });
    });
  }, [posthog, subscription]);

  const getCtaTextByVariant = (planName: string, price: string, variant: string): string => {
    // Basic plan always has same CTA
    if (planName === 'basic') return 'Get Started';

    // Return text based on variant
    switch (variant) {
      case 'value_focused':
        return `Go Ad-Free for ${price}/month`;

      case 'benefit_led':
        if (planName === 'standard') return 'Unlock Full HD & Downloads';
        if (planName === 'ultimate') return 'Unlock 8K & Exclusive Content';
        return 'Preview Subscription (No Charge)';

      case 'action_simple':
        const displayName = planName.charAt(0).toUpperCase() + planName.slice(1);
        return `Start ${displayName} Plan`;

      case 'control':
      default:
        return 'Preview Subscription (No Charge)';
    }
  };

  const plans = [
    {
      name: 'basic',
      displayName: 'Basic',
      price: 'Free',
      priceDetail: 'with ads',
      features: [
        'HD streaming quality',
        '1 profile',
        'Standard support',
        'Watch on any device',
        'Ad-supported content',
        'FlixBuddy AI assistant'
      ],
      cta: 'Get Started',
      popular: false
    },
    {
      name: 'standard',
      displayName: 'Standard',
      price: '$9.99',
      priceDetail: '/month',
      features: [
        'Full HD streaming',
        '3 profiles',
        'Priority support',
        'Watch on any device',
        'Ad-free experience',
        'Download for offline viewing',
        'FlixBuddy AI assistant'
      ],
      cta: getCtaTextByVariant('standard', '$9.99', ctaVariant),
      popular: true
    },
    {
      name: 'ultimate',
      displayName: 'Ultimate',
      price: '$29.99',
      priceDetail: '/month',
      features: [
        '8K + Dolby Vision',
        '10 profiles',
        'Dedicated support',
        'Watch on any device',
        'Ad-free experience',
        'Download for offline viewing',
        'Exclusive early access content',
        'Behind-the-scenes extras',
        'FlixBuddy AI assistant with priority',
        'Director\'s commentary tracks'
      ],
      cta: getCtaTextByVariant('ultimate', '$29.99', ctaVariant),
      popular: false
    }
  ];

  const isCurrentPlan = (planName: string) => {
    return subscription?.plan_name === planName;
  };

  const getButtonText = (plan: any) => {
    if (!user) return plan.cta;

    const currentPlan = subscription?.plan_name;
    if (currentPlan === plan.name) {
      return 'Current Plan ✓';
    }

    const planOrder = { basic: 0, standard: 1, ultimate: 2 };
    const currentOrder = planOrder[currentPlan as keyof typeof planOrder] || 0;
    const targetOrder = planOrder[plan.name as keyof typeof planOrder] || 0;

    if (targetOrder > currentOrder) {
      return `Upgrade to ${plan.displayName}`;
    } else if (targetOrder < currentOrder) {
      return `Downgrade to ${plan.displayName}`;
    }

    return plan.cta;
  };

  const handlePlanSelect = async (planName: string) => {
    if (loading) return;

    // Ultimate plan - behavior controlled by feature flag
    if (planName === 'ultimate') {
      if (import.meta.env.DEV) {
        console.log('🚩 Ultimate button clicked. Hook value:', ultimateButtonFixed, 'Type:', typeof ultimateButtonFixed);
      }

      // Check both the hook value AND direct PostHog check as fallback
      const isFixEnabled = ultimateButtonFixed === true || posthog?.isFeatureEnabled('Ultimate_button_subscription_fix') === true;
      if (import.meta.env.DEV) {
        console.log('🚩 Direct PostHog check:', posthog?.isFeatureEnabled('Ultimate_button_subscription_fix'));
        console.log('🚩 Final isFixEnabled:', isFixEnabled);
      }

      if (isFixEnabled) {
        // Feature flag is ON - redirect to working Stripe checkout
        posthog?.capture('pricing:ultimate_fixed_checkout', {
          feature_flag: 'Ultimate_button_subscription_fix',
          action: 'redirect_to_stripe'
        });
        window.open('https://buy.stripe.com/test_00w4gzbQR8dP5aC2VZ9Ve02', '_blank');
        return;
      } else {
        // Feature flag is OFF - simulate broken checkout (rage click + error tracking demo)
        // Uses a realistic async call chain so PostHog Error Tracking shows
        // a multi-frame stack trace, not just "setTimeout → anonymous"
        setLoading(true);

        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const errorContext = {
          feature_flag: 'Ultimate_button_subscription_fix',
          flag_value: false,
          transaction_id: transactionId,
          gateway: 'stripe',
          plan: 'ultimate',
          amount_cents: 2999,
          currency: 'USD',
          user_plan_current: subscription?.plan_name || 'none',
          retry_count: 0,
        };

        // Structured logs for Session Replay's Logs panel
        slog('PAYMENT', 'info', `Initializing checkout — plan: ultimate, amount: $29.99 USD`);
        slog('PAYMENT', 'info', `Transaction: ${transactionId}`);
        slog('PAYMENT', 'info', `Gateway: stripe, endpoint: api.stripe.com/v1/charges`);
        slog('AUTH', 'info', `Payment token validated — scope: charges:write`);
        slog('PAYMENT', 'warn', `⚠️ Gateway response timeout after 30000ms — transaction: ${transactionId}`);

        // --- Simulated payment processing chain (named functions = named stack frames) ---

        class PaymentGatewayError extends Error {
          public details: Record<string, any>;
          public cause?: unknown;
          constructor(message: string, details: Record<string, any>, cause?: unknown) {
            super(message);
            this.name = 'PaymentGatewayError';
            this.details = details;
            if (cause) this.cause = cause;
          }
        }
        class StripeConnectionError extends Error {
          constructor(message: string) {
            super(message);
            this.name = 'StripeConnectionError';
          }
        }

        /** Deepest frame: raw Stripe API call */
        function executeStripeCharge(txnId: string, amountCents: number): never {
          throw new StripeConnectionError(
            `ETIMEDOUT: Stripe API connection timed out after 30000ms (POST /v1/charges). ` +
            `Transaction: ${txnId}, Amount: ${amountCents} cents. ` +
            `Host: api.stripe.com:443, DNS resolved: 52.202.184.175`
          );
        }

        /** Gateway authorization wrapper */
        function authorizeWithGateway(txnId: string, gateway: string, amount: number): never {
          try {
            executeStripeCharge(txnId, amount);
          } catch (stripeErr) {
            throw new PaymentGatewayError(
              `Gateway authorization failed [${gateway}]: Unable to complete charge for transaction ${txnId}`,
              { gateway, txnId, amount, stage: 'authorization' },
              stripeErr
            );
          }
          // TypeScript: unreachable, but keeps the types happy
          throw new Error('unreachable');
        }

        /** Session initialization */
        function initializePaymentSession(plan: string, amount: number, txnId: string): never {
          // Simulate idempotency key + session setup
          const sessionId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          if (import.meta.env.DEV) console.log(`Payment session ${sessionId} initialized`);
          authorizeWithGateway(txnId, 'stripe', amount);
          throw new Error('unreachable');
        }

        /** Top-level subscription upgrade orchestrator */
        async function processSubscriptionUpgrade(ctx: typeof errorContext): Promise<never> {
          // Simulate a brief network delay for realism
          await new Promise(resolve => setTimeout(resolve, 800));
          initializePaymentSession(ctx.plan, ctx.amount_cents, ctx.transaction_id);
          throw new Error('unreachable');
        }

        // --- Kick off the chain ---
        processSubscriptionUpgrade(errorContext)
          .catch((err) => {
            setLoading(false);

            // Provide $exception_list with structured frames so the Error
            // Tracking UI renders a full, readable stack trace instead of
            // the single minified frame from err.stack.
            posthog?.capture('$exception', {
              $exception_list: [
                {
                  type: 'PaymentGatewayError',
                  value: err.message,
                  mechanism: { handled: true, synthetic: false },
                  stacktrace: {
                    type: 'raw' as const,
                    frames: [
                      { platform: 'web:javascript' as const, filename: 'src/pages/Pricing.tsx', function: 'handlePlanSelect', lineno: 302, colno: 9, in_app: true },
                      { platform: 'web:javascript' as const, filename: 'src/pages/Pricing.tsx', function: 'processSubscriptionUpgrade', lineno: 297, colno: 11, in_app: true },
                      { platform: 'web:javascript' as const, filename: 'src/pages/Pricing.tsx', function: 'initializePaymentSession', lineno: 289, colno: 11, in_app: true },
                      { platform: 'web:javascript' as const, filename: 'src/pages/Pricing.tsx', function: 'authorizeWithGateway', lineno: 272, colno: 13, in_app: true },
                    ],
                  },
                },
                {
                  type: 'StripeConnectionError',
                  value: (err as any).cause?.message || 'Stripe API connection timed out',
                  mechanism: { handled: false, synthetic: false },
                  stacktrace: {
                    type: 'raw' as const,
                    frames: [
                      { platform: 'web:javascript' as const, filename: 'src/pages/Pricing.tsx', function: 'authorizeWithGateway', lineno: 272, colno: 13, in_app: true },
                      { platform: 'web:javascript' as const, filename: 'src/pages/Pricing.tsx', function: 'executeStripeCharge', lineno: 261, colno: 17, in_app: true },
                    ],
                  },
                },
              ],
              $exception_message: err.message,
              $exception_type: 'PaymentGatewayError',
              ...errorContext,
              error_session_id: `cs_${Date.now()}`,
              ...landmarkProps({
                statusCode: 504,
                apiUrl: 'https://api.hogflix.io/api/payments/stripe/charge',
                screen: 'pricingScreen',
              }),
            });

            // Also fire a typed business event for dashboards
            posthog?.capture('pricing:ultimate_payment_error', errorContext);

            // Re-throw so the React Error Boundary catches it too
            // (gives Session Replay the red error overlay)
            throw err;
          });

        return;
      }
    }

    // Prevent selecting current plan
    if (isCurrentPlan(planName)) {
      toast.info("You're already on this plan!");
      return;
    }

    // Find the plan to get the display name
    const plan = plans.find(p => p.name === planName);
    const displayName = plan?.displayName || planName;

    // Track upgrade/downgrade
    const currentPlan = subscription?.plan_name;
    const planOrder = { basic: 0, standard: 1, ultimate: 2 };
    const currentOrder = planOrder[currentPlan as keyof typeof planOrder] || 0;
    const targetOrder = planOrder[planName as keyof typeof planOrder] || 0;

    if (currentPlan) {
      if (targetOrder > currentOrder) {
        posthog?.capture('subscription:upgrade_clicked', {
          from: currentPlan,
          to: planName
        });
      } else {
        posthog?.capture('subscription:downgrade_clicked', {
          from: currentPlan,
          to: planName
        });

        // Check if VIP retention offer should be shown
        // Flag is enabled if: is_vip = true AND customer_health_score < 50
        const isVipRetentionActive = vipRetentionEnabled === true || posthog?.isFeatureEnabled('vip_retention_offer') === true;

        if (isVipRetentionActive) {
          posthog?.capture('subscription:downgrade_intercepted', {
            from: currentPlan,
            to: planName,
            reason: 'vip_retention_offer'
          });
          setPendingDowngradePlan(planName);
          setShowRetentionModal(true);
          return; // Don't proceed with downgrade yet
        }
      }
    }

    posthog?.capture('pricing:plan_selected', {
      plan: planName,
      plan_display: displayName,
      cta_variant: ctaVariant,
      cta_text: plan?.cta,
      user_current_plan: subscription?.plan_name || 'none',
      is_upgrade: currentPlan && targetOrder > currentOrder,
      is_downgrade: currentPlan && targetOrder < currentOrder
    });
    posthog?.setPersonProperties({ company_plan: planName });

    // If not logged in, go to signup
    if (!user) {
      navigate(`/signup?plan=${planName}`);
      return;
    }

    // If logged in and selecting Basic plan, auto-assign it
    if (planName === 'basic') {
      setLoading(true);
      try {
        // Fetch the Basic plan ID
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('name', 'basic')
          .single();

        if (planError) throw planError;

        // Create or update user subscription
        const { error: subError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: user.id,
            plan_id: planData.id,
            status: 'active'
          }, {
            onConflict: 'user_id'
          });

        if (subError) throw subError;

        toast.success('Basic plan activated!');
        navigate('/profiles');
      } catch (error) {
        console.error('Error activating Basic plan:', error);
        toast.error('Failed to activate plan. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // If logged in and selecting paid plan, go to checkout
    navigate(`/checkout?plan=${planName}`);
  };

  // Handle retention offer acceptance
  const handleRetentionAccept = () => {
    setShowRetentionModal(false);
    setPendingDowngradePlan(null);
    toast.success('🎉 30% discount applied to your plan for the next 3 months!');
  };

  // Handle retention offer decline - proceed with downgrade
  const handleRetentionDecline = () => {
    setShowRetentionModal(false);
    if (pendingDowngradePlan) {
      // Continue with the original downgrade action
      const planName = pendingDowngradePlan;
      setPendingDowngradePlan(null);

      // For basic plan, activate it directly
      if (planName === 'basic') {
        handlePlanSelect(planName);
      } else {
        navigate(`/checkout?plan=${planName}`);
      }
    }
  };

  // Render table layout variant if assigned
  if (layoutVariant === 'table-layout') {
    return (
      <>
        <PricingTableLayout onPlanSelect={handlePlanSelect} loading={loading} />
        <RetentionOfferModal
          open={showRetentionModal}
          onOpenChange={setShowRetentionModal}
          onAccept={handleRetentionAccept}
          onDecline={handleRetentionDecline}
          currentPlan={subscription?.plan_display_name || subscription?.plan_name || 'Standard'}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-layout="card">
      <Header />

      <main className="container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience our complete subscription flow with PostHog analytics. This is a demo environment - no real charges occur.
          </p>
        </div>

        {/* Demo Environment Alert */}
        <Alert className="mb-16 max-w-4xl mx-auto">
          <Info className="h-4 w-4" />
          <AlertDescription>
            🎭 <strong>Demo Environment:</strong> This is a showcase application for PostHog analytics features. No actual billing or payment processing occurs - feel free to explore the entire subscription flow!
          </AlertDescription>
        </Alert>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan.name);

            return (
              <Card
                key={plan.name}
                className={`relative p-8 flex flex-col ${isCurrent
                  ? 'border-green-500 shadow-lg shadow-green-500/20 scale-105'
                  : plan.popular
                    ? 'border-primary shadow-lg scale-105 md:scale-110'
                    : 'border-border'
                  }`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500">
                    ✓ Current Plan
                  </Badge>
                )}
                {!isCurrent && plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.displayName}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-2">
                      {plan.priceDetail}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  ref={plan.name === 'ultimate' ? ultimateButtonRef : undefined}
                  className={`w-full ${plan.name === 'ultimate' ? 'ultimate-subscribe-button' : ''}`}
                  variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handlePlanSelect(plan.name)}
                  disabled={loading || isCurrent}
                >
                  {loading && plan.name === 'ultimate' ? 'Processing...' : loading ? 'Processing...' : getButtonText(plan)}
                  {!isCurrent && subscription && (
                    <>
                      {plan.name === 'ultimate' && subscription.plan_name !== plan.name && (
                        <ArrowRight className="w-4 h-4 ml-2" />
                      )}
                      {plan.name === 'basic' && subscription.plan_name !== 'basic' && (
                        <ArrowDown className="w-4 h-4 ml-2" />
                      )}
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4 text-left">
            <div>
              <h3 className="font-semibold mb-2">Is this real billing?</h3>
              <p className="text-muted-foreground">
                No! This is a demonstration environment built to showcase PostHog's powerful analytics capabilities. You can safely explore the entire checkout and subscription flow without any actual charges or payment processing. Feel free to test all features!
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I change plans later?</h3>
              <p className="text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time from your account settings.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards and PayPal.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* VIP Retention Modal */}
      <RetentionOfferModal
        open={showRetentionModal}
        onOpenChange={setShowRetentionModal}
        onAccept={handleRetentionAccept}
        onDecline={handleRetentionDecline}
        currentPlan={subscription?.plan_display_name || subscription?.plan_name || 'Standard'}
      />
    </div>
  );
};

export default Pricing;
