import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const posthog = usePostHog();
  const plan = searchParams.get('plan') || 'standard';

  useEffect(() => {
    document.title = "Payment Successful - HogFlix";
    
    const activateSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast.error('Please log in to continue');
          navigate('/login');
          return;
        }

        // Fetch plan details
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('name', plan)
          .single();

        if (planData) {
          // Update subscription
          await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: user.id,
              plan_id: planData.id,
              status: 'active',
              payment_intent: `stripe_test_${Date.now()}`
            }, {
              onConflict: 'user_id'
            });

          // Track success
          posthog?.capture('checkout:payment_success', { 
            plan,
            method: 'stripe',
            amount: planData.price_monthly 
          });
          posthog?.capture('subscription:created', { 
            plan,
            tier: planData.display_name,
            payment_method: 'stripe',
            is_paid: true
          });

          toast.success('Subscription activated successfully!');
        }

        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/profiles');
        }, 2000);

      } catch (error) {
        console.error('Error activating subscription:', error);
        toast.error('Something went wrong. Please contact support.');
      }
    };

    activateSubscription();
  }, [navigate, plan, posthog]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="p-12 text-center max-w-md">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Payment Successful!</h2>
        <p className="text-muted-foreground mb-6">
          Your subscription is now active. Enjoy HogFlix!
        </p>
        <p className="text-sm text-muted-foreground">Redirecting to profiles...</p>
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
