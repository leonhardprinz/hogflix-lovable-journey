import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, CreditCard, Loader2 } from 'lucide-react';
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
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    street: '',
    city: '',
    state: '',
    zip: ''
  });

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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  const validateForm = () => {
    if (!formData.name || !formData.cardNumber || !formData.expiry || !formData.cvv) {
      toast({
        title: "Missing information",
        description: "Please fill in all payment details",
        variant: "destructive"
      });
      return false;
    }
    
    if (formData.cardNumber.replace(/\s/g, '').length !== 16) {
      toast({
        title: "Invalid card number",
        description: "Please enter a valid 16-digit card number",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setProcessing(true);
    posthog?.capture('checkout:payment_processing', { 
      plan,
      amount: planDetails?.price_monthly 
    });

    // Simulate payment processing
    setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Generate fake payment intent
        const paymentIntent = `pi_fake_${Date.now()}_${user.id.slice(0, 8)}`;

        // Create subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: user.id,
            plan_id: planDetails.id,
            status: 'active',
            payment_intent: paymentIntent
          });

        if (error) throw error;

        posthog?.capture('checkout:payment_success', { 
          plan,
          amount: planDetails?.price_monthly 
        });
        posthog?.capture('subscription:created', { 
          plan,
          tier: planDetails?.display_name,
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
      }
    }, 2500);
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
        <h1 className="text-3xl font-bold mb-8">Complete Your Order</h1>
        
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

          {/* Payment Form */}
          <div>
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Cardholder Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={processing}
                  />
                </div>

                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={formData.cardNumber}
                      onChange={(e) => handleInputChange('cardNumber', formatCardNumber(e.target.value))}
                      className="pl-10"
                      maxLength={19}
                      disabled={processing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      value={formData.expiry}
                      onChange={(e) => handleInputChange('expiry', e.target.value)}
                      maxLength={5}
                      disabled={processing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      value={formData.cvv}
                      onChange={(e) => handleInputChange('cvv', e.target.value)}
                      maxLength={3}
                      disabled={processing}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-4">Billing Address</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        placeholder="123 Main St"
                        value={formData.street}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        disabled={processing}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          placeholder="San Francisco"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          disabled={processing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          placeholder="CA"
                          value={formData.state}
                          onChange={(e) => handleInputChange('state', e.target.value)}
                          maxLength={2}
                          disabled={processing}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="zip">ZIP Code</Label>
                      <Input
                        id="zip"
                        placeholder="94102"
                        value={formData.zip}
                        onChange={(e) => handleInputChange('zip', e.target.value)}
                        maxLength={5}
                        disabled={processing}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    `Pay $${planDetails.price_monthly}`
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  This is a demo payment form. No real charges will be made.
                </p>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
