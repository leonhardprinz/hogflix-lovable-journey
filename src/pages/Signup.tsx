import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, CheckCircle, Mail, Lock, ArrowRight, UserPlus, Calendar, ExternalLink } from 'lucide-react';
import { getAgeGroup } from '@/lib/posthog-utils';
import NewsletterOptIn from '@/components/NewsletterOptIn';
import { initiateHandoff } from '@/lib/posthog-handoff';

const Signup = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState('form'); // 'form', 'processing', 'success', 'verify'
  const [selectedPlan] = useState(searchParams.get('plan') || 'basic');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [birthDate, setBirthDate] = useState('');

  const navigate = useNavigate();
  const posthog = usePostHog();
  const { toast } = useToast();

  // Identity stitching for QR cross-device flow: if a previous anonymous
  // distinct_id was carried through the QR URL (?ph_did=...), alias this
  // device's anon id to it so the experiment exposure (on the desktop)
  // and the conversion (on this device) attribute to the same person.
  useEffect(() => {
    if (!posthog) return;
    const phDid = searchParams.get('ph_did');
    const fromQr = searchParams.get('from') === 'qr';
    if (phDid && fromQr) {
      try {
        // alias() tells PostHog: "the current distinct_id and the given id are
        // the same person". The server merges the records and preserves the
        // flag/experiment exposure from the original desktop session.
        posthog.alias(phDid);
        posthog.capture('qr_handoff_received', {
          from_distinct_id: phDid,
          to_distinct_id: posthog.get_distinct_id?.(),
        });
      } catch {
        // alias is best-effort; failing here shouldn't block signup.
      }
    }
  }, [posthog, searchParams]);

  // Surface the partner-verify return outcome to the user as a toast.
  // `onboarding.kyc.handoff_returned` is fired by App.tsx via detectHandoffReturn().
  useEffect(() => {
    const outcome = searchParams.get('handoff_outcome');
    const code = searchParams.get('handoff_code');
    if (!outcome) return;
    const titles: Record<string, string> = {
      success: 'Identity verified',
      failure: 'Verification declined',
      cancelled: 'Verification cancelled',
      timeout: 'Verification timed out',
    };
    toast({
      title: titles[outcome] ?? `Handoff returned: ${outcome}`,
      description: code ? `Code: ${code}` : undefined,
      variant: outcome === 'success' ? 'default' : 'destructive',
    });
    // Clean the URL so a refresh doesn't re-fire the toast.
    const url = new URL(window.location.href);
    url.searchParams.delete('handoff_outcome');
    url.searchParams.delete('handoff_code');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [searchParams, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStep('processing');
    try {
      localStorage.setItem('hogflix_signup_step', 'email_submit');
      localStorage.setItem('hogflix_current_plan', selectedPlan);
    } catch { /* localStorage may be unavailable */ }

    // Show processing toast
    toast({
      title: "Creating your account...",
      description: "Setting up your secure HogFlix account",
    });

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signupError) {
        setError(signupError.message);
        setStep('form');
        const wrapped = new Error(`SignupAuthError: ${signupError.message}`);
        wrapped.name = 'SignupAuthError';
        wrapped.cause = signupError;
        posthog?.captureException(wrapped, {
          signup_step: 'email_submit',
          selected_plan: selectedPlan,
          marketing_opt_in: marketingOptIn,
          auth_error_status: (signupError as any)?.status,
          auth_error_code: (signupError as any)?.code,
          $exception_fingerprint: ['SignupAuthError', (signupError as any)?.code || 'unknown'],
        });
        toast({
          title: "Sign up failed",
          description: signupError.message,
          variant: "destructive",
        });
        return;
      }

      // Capture signup event
      if (data.user) {
        const age_group = birthDate ? getAgeGroup(new Date(birthDate)) : undefined;

        posthog.identify(data.user.id, {
          email: data.user.email,
          $email: data.user.email,
          marketing_opt_in: marketingOptIn,
          ...(age_group && { age_group }),
        });
        
        posthog.capture('signup:completed', { 
          signup_method: 'email',
          selected_plan: selectedPlan,
          marketing_opt_in: marketingOptIn
        });
        
        // Experiment conversion event - matches PostHog experiment metric
        posthog.capture('user_signed_up', {
          signup_method: 'email',
          selected_plan: selectedPlan,
          marketing_opt_in: marketingOptIn,
          $set: { email: data.user.email }
        });
        
        posthog.capture('email:captured', {
          source: 'signup',
          marketing_opt_in: marketingOptIn
        });

        // Save marketing preference to profiles table
        await supabase
          .from('profiles')
          .update({ marketing_opt_in: marketingOptIn })
          .eq('user_id', data.user.id);
      }

      if (data.session?.user) {
        // Identify and redirect only when session exists (email confirmation disabled)
        posthog.identify(data.session.user.id, {
          email: data.session.user.email
        });
        
        setStep('success');
        setSuccess(true);
        
        toast({
          title: "Account created successfully!",
          description: "Welcome to HogFlix! Redirecting...",
        });
        
        setTimeout(() => {
          // Redirect based on plan
          if (selectedPlan === 'basic') {
            navigate('/profiles');
          } else {
            navigate(`/checkout?plan=${selectedPlan}`);
          }
        }, 2000);
      } else {
        setStep('verify');
        setInfo('Account created! Check your email for a confirmation link to activate your account.');
        toast({
          title: "Verify your email",
          description: "We've sent a confirmation link to your email address. Please check your inbox and spam folder.",
        });
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setStep('form');
      const baseErr = err instanceof Error ? err : new Error(String(err));
      const wrapped = new Error(`SignupUnexpectedError: ${baseErr.message}`);
      wrapped.name = 'SignupUnexpectedError';
      wrapped.cause = baseErr;
      posthog?.captureException(wrapped, {
        signup_step: 'email_submit',
        selected_plan: selectedPlan,
        marketing_opt_in: marketingOptIn,
        $exception_fingerprint: ['SignupUnexpectedError'],
      });
      toast({
        title: "Something went wrong",
        description: "Please try again or contact support if the issue persists.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Razorpay-pattern demo: simulated KYC handoff to a third-party identity
   * provider (Digilocker). Mirrors how PostHog can bracket cross-domain
   * redirects so the funnel never goes silent during the external step.
   */
  const handlePartnerVerify = (provider: 'digilocker' | 'hyperverge_vkyc') => {
    const handoffSessionId = `ho_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const returnTo = '/signup';
    initiateHandoff(posthog, {
      flow: 'onboarding.kyc',
      provider,
      expected_return_url: returnTo,
      handoff_session_id: handoffSessionId,
      extra: {
        selected_plan: selectedPlan,
        signup_step: 'kyc_verification',
      },
    });
    const url = `/partner-verify?return_to=${encodeURIComponent(returnTo)}&partner=${provider === 'digilocker' ? 'Digilocker' : 'HyperVerge VKYC'}`;
    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-dark via-background-dark to-background-dark/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-red/10 rounded-full mb-4">
            {step === 'success' ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : step === 'verify' ? (
              <Mail className="w-8 h-8 text-blue-500" />
            ) : (
              <UserPlus className="w-8 h-8 text-primary-red" />
            )}
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">HogFlix</h1>
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            {step === 'success' ? 'Welcome Aboard!' : 
             step === 'verify' ? 'Check Your Email' : 
             'Join HogFlix'}
          </h2>
          <p className="text-text-secondary mb-3">
            {step === 'success' ? 'Your account has been created successfully' :
             step === 'verify' ? 'We sent you a confirmation link' :
             'Create your secure account to start streaming'}
          </p>
          {selectedPlan && step !== 'success' && step !== 'verify' && (
            <Badge variant="outline" className="mt-2">
              Selected: {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan
            </Badge>
          )}
        </div>

        <div className="bg-background-dark/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-8 shadow-2xl">
          {step === 'verify' ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 font-semibold mb-2">Almost there!</p>
                <p className="text-text-secondary text-sm">
                  We've sent a verification email to <strong className="text-text-primary">{email}</strong>
                </p>
              </div>
              <div className="text-sm text-text-tertiary">
                <p>Next steps:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-left">
                  <li>Check your email inbox</li>
                  <li>Click the confirmation link</li>
                  <li>Return to sign in</li>
                </ol>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="btn-primary w-full"
              >
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-text-primary font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-netflix h-12 text-lg transition-all duration-200 focus:ring-2 focus:ring-primary-red/20"
                  placeholder="Enter your email"
                  required
                  disabled={loading || success}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-text-primary font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-netflix h-12 text-lg transition-all duration-200 focus:ring-2 focus:ring-primary-red/20"
                  placeholder="Create a secure password"
                  required
                  disabled={loading || success}
                />
                <p className="text-xs text-text-tertiary">
                  Choose a strong password with at least 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate" className="text-text-primary font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  生年月日 / Date of Birth
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="input-netflix h-12 text-lg transition-all duration-200 focus:ring-2 focus:ring-primary-red/20"
                  required
                  disabled={loading || success}
                />
                <p className="text-xs text-text-tertiary">
                  年齢層別セグメンテーションに使用 / Used for age-based segmentation
                </p>
              </div>

              {/* Newsletter Opt-In */}
              <NewsletterOptIn
                email={email}
                checked={marketingOptIn}
                onChange={setMarketingOptIn}
                disabled={loading || success}
              />

              {/* Razorpay-pattern demo: simulated third-party identity handoff */}
              <div className="rounded-lg border border-blue-700/40 bg-blue-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-200">
                    Optional: verify identity via partner
                  </span>
                </div>
                <p className="text-xs text-text-tertiary">
                  Demonstrates a cross-domain handoff (Digilocker / VKYC pattern). PostHog
                  brackets the round-trip with <code>onboarding.kyc.handoff_initiated</code> →{' '}
                  <code>onboarding.kyc.handoff_returned</code>, so the external step is never silent.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-blue-700/60 text-blue-200 hover:bg-blue-900/30"
                    onClick={() => handlePartnerVerify('digilocker')}
                    disabled={loading || success}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Verify with Digilocker
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-blue-700/60 text-blue-200 hover:bg-blue-900/30"
                    onClick={() => handlePartnerVerify('hyperverge_vkyc')}
                    disabled={loading || success}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Verify with HyperVerge VKYC
                  </Button>
                </div>
              </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-600 rounded text-red-400 text-sm" role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 bg-emerald-900/20 border border-emerald-600 rounded text-emerald-400 text-sm" role="status" aria-live="polite">
              {info}
            </div>
          )}

              <Button
                type="submit"
                disabled={loading || success}
                className={`w-full h-12 text-lg font-semibold transition-all duration-300 ${
                  success 
                    ? 'bg-green-600 hover:bg-green-600 text-white' 
                    : loading 
                      ? 'bg-primary-red/70 text-white' 
                      : 'btn-primary hover:bg-primary-red/90 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Account Created! Redirecting...
                  </div>
                ) : loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {step === 'processing' ? 'Creating your account...' : 'Signing up...'}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Create Account
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </Button>
            </form>
          )}
        </div>

        {step !== 'verify' && (
          <div className="mt-8 text-center space-y-4">
            <div className="flex items-center gap-2 justify-center text-sm text-text-tertiary">
              <Shield className="w-4 h-4" />
              256-bit SSL encryption • GDPR compliant • Your data is safe
            </div>
            
            <div className="pt-4 border-t border-gray-800/50">
              <p className="text-text-secondary mb-3">
                Already have an account?
              </p>
              <Button
                onClick={() => navigate('/login')}
                variant="outline"
                className="w-full sm:w-auto border-2 border-primary-red/50 text-primary-red hover:bg-primary-red/10 hover:border-primary-red font-semibold px-8 py-2 transition-all"
              >
                Sign In to Your Account
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;