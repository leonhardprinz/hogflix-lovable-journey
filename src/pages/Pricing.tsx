import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { usePostHog } from 'posthog-js/react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Pricing = () => {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Pricing – HogFlix";
    posthog?.capture('pricing:viewed');
  }, [posthog]);

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
        'Ad-supported content'
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
        'Download for offline viewing'
      ],
      cta: 'Start Free Trial',
      popular: true
    },
    {
      name: 'premium',
      displayName: 'Premium',
      price: '$19.99',
      priceDetail: '/month',
      features: [
        '4K + HDR quality',
        '5 profiles',
        'Priority support',
        'Watch on any device',
        'Ad-free experience',
        'Download for offline viewing',
        'Early access to new content',
        'FlixBuddy AI assistant'
      ],
      cta: 'Start Free Trial',
      popular: false
    }
  ];

  const handlePlanSelect = async (planName: string) => {
    posthog?.capture('pricing:plan_selected', { plan: planName });
    
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
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start with Basic for free or upgrade for premium features. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative p-8 flex flex-col ${
                plan.popular
                  ? 'border-primary shadow-lg scale-105 md:scale-110'
                  : 'border-border'
              }`}
            >
              {plan.popular && (
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
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
                size="lg"
                onClick={() => handlePlanSelect(plan.name)}
                disabled={loading}
              >
                {loading ? 'Processing...' : plan.cta}
              </Button>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4 text-left">
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
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                Yes! Standard and Premium plans come with a 7-day free trial. No credit card required for Basic.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
