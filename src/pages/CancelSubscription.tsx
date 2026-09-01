import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { Ban, Check, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';

const CANCEL_REASONS = [
  'Too expensive',
  'Not watching enough',
  'Missing content I want',
  'Technical problems',
  'Just taking a break',
  'Other',
];

export default function CancelSubscription() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { subscription, loading, isFreePlan, cancelSubscription } = useSubscription();

  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [done, setDone] = useState(false);

  const hasPaidPlan = !!subscription && !isFreePlan;

  useEffect(() => {
    document.title = 'Cancel Subscription - HogFlix';
  }, []);

  // Record that a subscriber reached the cancellation surface. This is the
  // top of the funnel the product was previously blind to.
  useEffect(() => {
    if (!loading && hasPaidPlan && !done) {
      posthog?.capture('subscription:cancel_viewed', {
        plan: subscription?.plan_name,
        tier: subscription?.plan_display_name,
      });
    }
  }, [loading, hasPaidPlan, done, posthog, subscription]);

  const handleConfirmCancel = async () => {
    setCancelling(true);

    // The attempt. Fires before the mutation so the funnel sees intent even
    // when the cancellation itself fails.
    posthog?.capture('subscription:cancel_requested', {
      plan: subscription?.plan_name,
      tier: subscription?.plan_display_name,
      reason: reason || null,
    });

    try {
      const fromPlan = subscription?.plan_name;
      const fromTier = subscription?.plan_display_name;

      await cancelSubscription();

      // The completion.
      posthog?.capture('subscription:cancelled', {
        from_plan: fromPlan,
        from_tier: fromTier,
        to_plan: 'basic',
        reason: reason || null,
      });

      setConfirmOpen(false);
      setDone(true);
      toast.success('Your subscription has been cancelled.');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const wrapped = new Error(`SubscriptionCancelError: ${err.message}`);
      wrapped.name = 'SubscriptionCancelError';
      wrapped.cause = err;
      posthog?.captureException(wrapped, {
        plan: subscription?.plan_name,
        tier: subscription?.plan_display_name,
        $exception_fingerprint: ['SubscriptionCancelError'],
      });
      toast.error('Could not cancel your subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2 flex items-center gap-2">
            <Ban className="h-8 w-8 text-primary-red" />
            Cancel Subscription
          </h1>
          <p className="text-text-secondary">
            Manage your HogFlix plan and stop future payments.
          </p>
        </div>

        {done ? (
          <Card className="bg-surface border-border">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Subscription cancelled
              </h2>
              <p className="text-text-secondary mb-6">
                Your paid plan has ended and your account is now on the free Basic plan.
                You can resubscribe at any time.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" onClick={() => navigate('/browse')}>
                  Back to browsing
                </Button>
                <Button onClick={() => navigate('/pricing')}>
                  View plans
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !hasPaidPlan ? (
          <Card className="bg-surface border-border">
            <CardContent className="py-10 text-center">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Nothing to cancel
              </h2>
              <p className="text-text-secondary mb-6">
                Your account is on the free Basic plan, so there are no payments to stop.
              </p>
              <Button onClick={() => navigate('/pricing')}>
                View plans
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-2xl text-text-primary">
                {subscription?.plan_display_name} plan
              </CardTitle>
              <CardDescription className="text-text-secondary">
                ${subscription?.price_monthly}/month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-border bg-background/40 p-4 text-sm text-text-secondary space-y-2">
                <p className="font-semibold text-text-primary">What happens when you cancel:</p>
                <p>• Your account moves to the free Basic plan.</p>
                <p>• Future payments stop and you keep your profiles and watch history.</p>
                <p>• You lose paid features such as extra profiles and higher video quality.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Why are you leaving? (optional)
                </label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="bg-background/40 border-border text-text-primary">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button variant="outline" onClick={() => navigate('/pricing')}>
                  Keep my plan
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  Cancel subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your {subscription?.plan_display_name} plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account will move to the free Basic plan and future payments will stop.
              You can resubscribe at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep my plan</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, cancel'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
