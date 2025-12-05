import { Check, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import Header from '@/components/Header';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePostHog } from 'posthog-js/react';

interface PricingTableLayoutProps {
  onPlanSelect: (planName: string) => void;
  loading: boolean;
}

const PricingTableLayout = ({ onPlanSelect, loading }: PricingTableLayoutProps) => {
  const { subscription } = useSubscription();
  const posthog = usePostHog();

  const plans = [
    { name: 'basic', displayName: 'Basic', price: 'Free', priceDetail: 'with ads' },
    { name: 'standard', displayName: 'Standard', price: '$9.99', priceDetail: '/month', popular: true },
    { name: 'ultimate', displayName: 'Ultimate', price: '$29.99', priceDetail: '/month' },
  ];

  const features = [
    { name: 'Streaming Quality', basic: 'HD', standard: 'Full HD', ultimate: '8K + Dolby Vision' },
    { name: 'Profiles', basic: '1', standard: '3', ultimate: '10' },
    { name: 'Ad-free Experience', basic: false, standard: true, ultimate: true },
    { name: 'Download for Offline', basic: false, standard: true, ultimate: true },
    { name: 'Watch on Any Device', basic: true, standard: true, ultimate: true },
    { name: 'FlixBuddy AI Assistant', basic: true, standard: true, ultimate: true },
    { name: 'Priority Support', basic: false, standard: true, ultimate: true },
    { name: 'Exclusive Early Access', basic: false, standard: false, ultimate: true },
    { name: 'Behind-the-scenes Extras', basic: false, standard: false, ultimate: true },
    { name: "Director's Commentary", basic: false, standard: false, ultimate: true },
  ];

  const isCurrentPlan = (planName: string) => subscription?.plan_name === planName;

  const handlePlanHover = (planName: string) => {
    posthog?.capture('pricing:plan_hover', {
      plan: planName,
      layout: 'table',
      timestamp: new Date().toISOString()
    });
  };

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-5 h-5 text-green-500 mx-auto" />
      ) : (
        <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  return (
    <div className="min-h-screen bg-background" data-layout="table">
      <Header />

      <main className="container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-orange-500 to-yellow-500 bg-clip-text text-transparent">
            Compare Plans
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find the perfect plan for your streaming needs
          </p>
        </div>

        {/* Demo Environment Alert */}
        <Alert className="mb-12 max-w-4xl mx-auto border-primary/30 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription>
            🎭 <strong>Demo Environment:</strong> This is a showcase for PostHog analytics. No actual billing occurs!
          </AlertDescription>
        </Alert>

        {/* Pricing Table */}
        <div className="max-w-5xl mx-auto overflow-x-auto">
          <table className="w-full border-collapse" data-testid="pricing-table">
            {/* Header Row */}
            <thead>
              <tr>
                <th className="p-4 text-left text-muted-foreground font-normal border-b border-border">
                  Features
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.name}
                    className={`p-4 text-center border-b relative ${
                      plan.popular ? 'bg-primary/10 border-primary/30' : 'border-border'
                    } ${isCurrentPlan(plan.name) ? 'bg-green-500/10' : ''}`}
                    onMouseEnter={() => handlePlanHover(plan.name)}
                    data-plan={plan.name}
                  >
                    {plan.popular && !isCurrentPlan(plan.name) && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary animate-pulse">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Most Popular
                      </Badge>
                    )}
                    {isCurrentPlan(plan.name) && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500">
                        ✓ Current Plan
                      </Badge>
                    )}
                    <div className="pt-4">
                      <h3 className="text-xl font-bold text-foreground">{plan.displayName}</h3>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground text-sm ml-1">{plan.priceDetail}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Feature Rows */}
            <tbody>
              {features.map((feature, index) => (
                <tr
                  key={feature.name}
                  className={`${index % 2 === 0 ? 'bg-card/50' : ''} hover:bg-card transition-colors`}
                  data-feature={feature.name}
                >
                  <td className="p-4 text-sm text-muted-foreground border-b border-border/50">
                    {feature.name}
                  </td>
                  <td className={`p-4 text-center border-b border-border/50`}>
                    {renderFeatureValue(feature.basic)}
                  </td>
                  <td className={`p-4 text-center border-b border-border/50 bg-primary/5`}>
                    {renderFeatureValue(feature.standard)}
                  </td>
                  <td className={`p-4 text-center border-b border-border/50`}>
                    {renderFeatureValue(feature.ultimate)}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* CTA Row */}
            <tfoot>
              <tr>
                <td className="p-4"></td>
                {plans.map((plan) => (
                  <td key={plan.name} className={`p-6 text-center ${plan.popular ? 'bg-primary/5' : ''}`}>
                    <Button
                      className={`w-full ${plan.name === 'ultimate' ? 'ultimate-subscribe-button' : ''}`}
                      variant={isCurrentPlan(plan.name) ? 'outline' : plan.popular ? 'default' : 'outline'}
                      size="lg"
                      onClick={() => onPlanSelect(plan.name)}
                      disabled={loading || isCurrentPlan(plan.name)}
                      data-plan-cta={plan.name}
                    >
                      {loading ? 'Processing...' : isCurrentPlan(plan.name) ? 'Current Plan ✓' : 
                        plan.name === 'basic' ? 'Get Started' : `Choose ${plan.displayName}`}
                    </Button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Card View (for smaller screens) */}
        <div className="md:hidden mt-8 space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-6 rounded-lg border ${
                plan.popular ? 'border-primary bg-primary/5' : 'border-border bg-card'
              } ${isCurrentPlan(plan.name) ? 'border-green-500 bg-green-500/5' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{plan.displayName}</h3>
                  <div className="mt-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm ml-1">{plan.priceDetail}</span>
                  </div>
                </div>
                {plan.popular && !isCurrentPlan(plan.name) && (
                  <Badge className="bg-primary">Popular</Badge>
                )}
                {isCurrentPlan(plan.name) && (
                  <Badge className="bg-green-500">Current</Badge>
                )}
              </div>
              <Button
                className="w-full"
                variant={isCurrentPlan(plan.name) ? 'outline' : plan.popular ? 'default' : 'outline'}
                onClick={() => onPlanSelect(plan.name)}
                disabled={loading || isCurrentPlan(plan.name)}
              >
                {loading ? 'Processing...' : isCurrentPlan(plan.name) ? 'Current Plan ✓' : 
                  plan.name === 'basic' ? 'Get Started' : `Choose ${plan.displayName}`}
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Questions?</h2>
          <p className="text-muted-foreground">
            This is a demo environment - no real charges occur. Explore freely!
          </p>
        </div>
      </main>
    </div>
  );
};

export default PricingTableLayout;
