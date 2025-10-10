import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Check, CreditCard, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { toast } = useToast();
  
  const [plan, setPlan] = useState<string>('');
  const [planDetails, setPlanDetails] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [processingMethod, setProcessingMethod] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [showStripeWarning, setShowStripeWarning] = useState(false);

  const stripeCheckoutUrls: { [key: string]: string } = {
    standard: 'https://buy.stripe.com/test_6oUfZh1cdfGh1Yqcwz9Ve00',
    premium: 'https://buy.stripe.com/test_dRmcN58EF8dPfPg7cf9Ve01'
  };

  const paymentMethods = [
    {
      id: 'stripe',
      name: 'Pay with Stripe',
      icon: CreditCard,
      description: 'Secure payment via Stripe (Sandbox)',
      emoji: '💳',
      isPrimary: true
    },
    {
      id: 'card',
      name: 'Pay with Card',
      icon: CreditCard,
      description: 'Traditional card payment demo',
      emoji: '💳'
    },
    {
      id: 'hedgepal',
      name: 'HedgePal',
      description: 'The hedgehog payment network',
      emoji: '🦔'
    },
    {
      id: 'stripedhedge',
      name: 'StripedHedge',
      description: 'Secure hedgehog transactions',
      emoji: 'S',
      isLetter: true
    },
    {
      id: 'applehog',
      name: 'AppleHog',
      description: 'One-tap hedgehog checkout',
      emoji: '🍎'
    }
  ];

  useEffect(() => {
    document.title = "Checkout – HogFlix";
    const selectedPlan = searchParams.get('plan') || '';
    setPlan(selectedPlan);
    
    if (selectedPlan === 'basic') {
      navigate('/profiles');
      return;
    }

    fetchPlanDetails(selectedPlan);
    posthog?.capture('checkout:viewed', { plan: selectedPlan });
  }, [searchParams, navigate, posthog]);

  const fetchPlanDetails = async (planName: string) => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', planName)
      .single();
    
    if (data) setPlanDetails(data);
  };

  const handleStripeCheckout = () => {
    posthog?.capture('checkout:stripe_redirect', { plan });
    
    // Redirect to Stripe checkout
    const stripeUrl = stripeCheckoutUrls[plan];
    if (stripeUrl) {
      window.location.href = stripeUrl;
    }
  };

  const handlePaymentMethodClick = (methodId: string) => {
    if (methodId === 'stripe') {
      posthog?.capture('checkout:stripe_selected', { plan });
      setShowStripeWarning(true);
    } else {
      handlePaymentMethod(methodId);
    }
  };

  const handlePaymentMethod = async (methodId: string) => {
    setProcessing(true);
    setProcessingMethod(methodId);
    
    posthog?.capture('checkout:payment_method_selected', { 
      plan,
      method: methodId
    });
    
    posthog?.capture('checkout:payment_processing', { 
      plan,
      method: methodId,
      amount: planDetails?.price_monthly 
    });

    // Simulate payment processing
    setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Generate fake payment intent with method
        const paymentIntent = `pi_fake_${methodId}_${Date.now()}`;

        // Create subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: user.id,
            plan_id: planDetails.id,
            status: 'active',
            payment_intent: paymentIntent
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;

        posthog?.capture('checkout:payment_success', { 
          plan,
          method: methodId,
          amount: planDetails?.price_monthly 
        });
        posthog?.capture('subscription:created', { 
          plan,
          tier: planDetails?.display_name,
          payment_method: methodId,
          is_paid: true
        });

        setSuccess(true);
        
        setTimeout(() => {
          navigate('/profiles');
        }, 2000);

      } catch (error) {
        console.error('Checkout error:', error);
        toast({
          title: "Payment failed",
          description: "Something went wrong. Please try again.",
          variant: "destructive"
        });
        setProcessing(false);
        setProcessingMethod('');
      }
    }, 1500);
  };

  if (!planDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-12 text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Payment Successful!</h2>
          <p className="text-muted-foreground mb-6">
            Your {planDetails.display_name} plan is now active. Enjoy!
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to profiles...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-3xl font-bold mb-4">Complete Your Order</h1>
        
        {/* Demo Environment Alert */}
        <Alert className="mb-8 border-amber-500 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>🎭 Demo Environment Options:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• <strong>Stripe (Recommended):</strong> Experience a real checkout flow in Stripe's sandbox. Use test card <code className="bg-background px-1 rounded">4242 4242 4242 4242</code></li>
              <li>• <strong>Demo Methods:</strong> Simulate payment instantly without leaving this page</li>
            </ul>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
              ⚠️ <strong>NEVER enter real credit card information</strong> - this is a TEST environment only!
            </p>
          </AlertDescription>
        </Alert>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div>
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{planDetails.display_name} Plan</span>
                  <span className="text-xl font-bold">
                    ${planDetails.price_monthly}/month
                  </span>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-2">Features included:</p>
                  <ul className="space-y-2">
                    {(planDetails.features as string[]).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Due Today</span>
                  <span>${planDetails.price_monthly}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Payment Methods */}
          <div>
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-2">Choose Payment Method</h2>
              <p className="text-sm text-muted-foreground mb-6">
                All payment methods are simulated for demonstration purposes
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paymentMethods.map((method) => (
              <Card 
                key={method.id}
                className={`p-6 transition-colors cursor-pointer relative ${
                  method.isPrimary 
                    ? 'border-primary bg-primary/5 hover:bg-primary/10' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => !processing && handlePaymentMethodClick(method.id)}
              >
                    {processing && processingMethod === method.id && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    )}
                    
                    <div className="text-center space-y-3">
                      <div className={`text-4xl mb-2 ${method.isLetter ? 'font-bold text-purple-600 bg-purple-100 dark:bg-purple-950 dark:text-purple-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-3xl' : ''}`}>
                        {method.emoji}
                      </div>
                      <h3 className="font-semibold">{method.name}</h3>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2"
                        disabled={processing}
                      >
                        {processing && processingMethod === method.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Select'
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              
              <p className="text-xs text-center text-muted-foreground mt-6">
                💡 Click any payment method to continue - no real charges will be made
              </p>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showStripeWarning} onOpenChange={setShowStripeWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                ⚠️ Stripe Sandbox Environment
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p className="font-semibold text-amber-600 dark:text-amber-500">
                  DO NOT ENTER REAL CREDIT CARD INFORMATION
                </p>
                <p>
                  You're about to be redirected to Stripe's test/sandbox environment. This is for demonstration purposes only.
                </p>
                <div className="bg-muted p-3 rounded-md space-y-2 text-sm">
                  <p className="font-semibold">Use these test card details:</p>
                  <p>Card Number: <code className="bg-background px-2 py-1 rounded">4242 4242 4242 4242</code></p>
                  <p>Expiry: Any future date (e.g., 12/34)</p>
                  <p>CVC: Any 3 digits (e.g., 123)</p>
                  <p>ZIP: Any 5 digits (e.g., 12345)</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  This demo showcases PostHog's e-commerce analytics. No real transactions will occur.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStripeCheckout}>
                I Understand - Continue to Stripe
              </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
};

export default Checkout;
