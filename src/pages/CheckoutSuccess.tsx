import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlanDetails {
  display_name: string;
  price_monthly: number;
  features: string[];
  video_quality: string;
  max_profiles: number;
}

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const posthog = usePostHog();
  const plan = searchParams.get('plan') || 'standard';
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);

  useEffect(() => {
    document.title = "Payment Successful - HogFlix";
    
    const verifyAndActivateSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error('Please log in to continue');
          navigate('/login');
          return;
        }

        console.log('Verifying subscription with backend...');

        // Call verify-subscription edge function to securely check subscription
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
          'verify-subscription',
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (verifyError) {
          console.error('Verification error:', verifyError);
          toast.error('Failed to verify subscription. Please contact support.');
          return;
        }

        console.log('Verification response:', verifyData);

        if (verifyData.hasSubscription && verifyData.subscription) {
          const sub = verifyData.subscription;
          
          // Fetch full plan details for display
          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('name', sub.plan_name)
            .single();

          if (planData) {
            setPlanDetails({
              display_name: planData.display_name,
              price_monthly: planData.price_monthly,
              features: Array.isArray(planData.features) 
                ? (planData.features as string[])
                : [],
              video_quality: planData.video_quality,
              max_profiles: planData.max_profiles
            });

            // Track success events
            posthog?.capture('checkout:payment_verified', { 
              plan: sub.plan_name,
              tier: planData.display_name
            });
            posthog?.capture('checkout:success_viewed');

            toast.success('Subscription verified successfully!');
          }
        } else {
          console.warn('No active subscription found after payment');
          toast.warning('Payment received, but subscription not yet active. Please refresh or contact support.');
        }

      } catch (error) {
        console.error('Error verifying subscription:', error);
        toast.error('Something went wrong. Please contact support.');
      }
    };

    verifyAndActivateSubscription();
  }, [navigate, posthog]);


  const getNextBillingDate = () => {
    const today = new Date();
    const nextBilling = new Date(today);
    nextBilling.setMonth(today.getMonth() + 1);
    return nextBilling.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getPlanColor = () => {
    if (plan === 'premium') return 'text-yellow-500';
    if (plan === 'standard') return 'text-blue-500';
    return 'text-gray-500';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center pb-4">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <Check className="w-10 h-10 text-green-500" />
            <Sparkles className="w-5 h-5 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <CardTitle className="text-3xl font-bold mb-2">
            🎉 Congratulations!
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {planDetails ? (
            <>
              {/* Plan Name */}
              <div className="text-center">
                <h3 className={`text-2xl font-bold mb-2 ${getPlanColor()}`}>
                  Welcome to HogFlix {planDetails.display_name}!
                </h3>
                <Badge variant="outline" className="text-base px-4 py-1">
                  {planDetails.video_quality} Quality • {planDetails.max_profiles} Profiles
                </Badge>
              </div>

              {/* Features */}
              <div className="bg-muted/50 rounded-lg p-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Your Benefits
                </h4>
                <ul className="space-y-2">
                  {planDetails.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Billing Info */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold">{planDetails.display_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-semibold">
                    ${planDetails.price_monthly.toFixed(2)}/month
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Next billing</span>
                  <span className="font-semibold">{getNextBillingDate()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="default" className="bg-green-500">
                    Active
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-4">
                <Button
                  onClick={() => navigate('/profiles')}
                  size="lg"
                  className="w-full"
                >
                  Start Watching <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  onClick={() => navigate('/pricing')}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  View Subscription Details
                </Button>
              </div>

            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Activating your subscription...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
