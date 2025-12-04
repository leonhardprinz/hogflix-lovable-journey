import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, ArrowRight, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';
import { usePostHog } from 'posthog-js/react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRageClickDetection } from '@/hooks/useRageClickDetection';

const Pricing = () => {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [ctaVariant, setCtaVariant] = useState<string>('control');
  const [ultimateButtonFixed, setUltimateButtonFixed] = useState(false);
  const ultimateButtonRef = useRef<HTMLButtonElement>(null);

  // Rage click detection for Ultimate button
  useRageClickDetection(ultimateButtonRef, {
    threshold: 3,
    timeWindow: 2000,
    elementSelector: 'button.ultimate-subscribe-button'
  });

  useEffect(() => {
    document.title = "Pricing – HogFlix";
    posthog?.capture('pricing:viewed', {
      user_plan: subscription?.plan_name || 'none',
      is_free_user: subscription?.plan_name === 'basic' || !subscription
    });

    // Load feature flag variants
    posthog?.onFeatureFlags(() => {
      const ctaExperimentVariant = posthog.getFeatureFlag('pricing_upgrade_cta_experiment');
      if (ctaExperimentVariant && typeof ctaExperimentVariant === 'string') {
        setCtaVariant(ctaExperimentVariant);

        posthog?.capture('pricing:cta_variant_assigned', {
          variant: ctaExperimentVariant,
          user_plan: subscription?.plan_name || 'none',
          timestamp: new Date().toISOString()
        });
      }

      // Check if Ultimate button fix is enabled
      const ultimateFixEnabled = posthog.getFeatureFlag('Ultimate_button_subscription_fix');
      setUltimateButtonFixed(ultimateFixEnabled === true);

      posthog?.capture('feature_flag:ultimate_button_fix_assigned', {
        enabled: ultimateFixEnabled === true,
        user_plan: subscription?.plan_name || 'none',
        timestamp: new Date().toISOString()
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
      if (ultimateButtonFixed) {
        // Feature flag is ON - redirect to working Stripe checkout
        posthog?.capture('pricing:ultimate_fixed_checkout', {
          feature_flag: 'Ultimate_button_subscription_fix',
          action: 'redirect_to_stripe'
        });
        window.open('https://buy.stripe.com/test_00w4gzbQR8dP5aC2VZ9Ve02', '_blank');
        return;
      } else {
        // Feature flag is OFF - simulate broken button (rage click demo)
        setLoading(true);
        setTimeout(() => {
          setLoading(false);
          posthog?.capture('pricing:ultimate_payment_error', {
            feature_flag: 'Ultimate_button_subscription_fix',
            flag_value: false,
            error: 'Payment Gateway Connection Failed'
          });
          throw new Error("Payment Gateway Connection Failed: Timeout waiting for response from provider.");
        }, 1000);
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

  return (
    <div className="min-h-screen bg-background">
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
    </div>
  );
};

export default Pricing;
