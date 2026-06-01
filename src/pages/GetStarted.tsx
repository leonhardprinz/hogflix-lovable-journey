/**
 * /get-started — anonymous-user experiment landing page.
 *
 * Multivariate feature flag `signup_method_test`:
 *   - `form`: traditional email sign-up form inline
 *   - `qr`:   QR code that deep-links to /signup?from=qr&ph_did=<distinct_id>
 *
 * Mirrors TBC's card-application CTA experiment (QR-to-app vs form-fill).
 * Demonstrates the cross-device identity-stitching pattern via the ph_did
 * query param carried through the QR URL.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Smartphone, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import { usePostHog, useFeatureFlagVariantKey } from 'posthog-js/react';
import { toast } from 'sonner';

const FLAG_KEY = 'signup_method_test';

const GetStarted = () => {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const variant = useFeatureFlagVariantKey(FLAG_KEY) as string | undefined;

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');

  // Trigger experiment exposure as soon as posthog + variant are ready.
  // useFeatureFlagVariantKey calls getFeatureFlag under the hood, which
  // emits $feature_flag_called. Track a dedicated marketing event too so
  // we have a clean exposure signal in the funnel.
  useEffect(() => {
    if (!posthog || !variant) return;
    posthog.capture('get_started_viewed', {
      [`$feature/${FLAG_KEY}`]: variant,
      variant_seen: variant,
    });
  }, [posthog, variant]);

  // Build the QR target URL carrying the current anonymous distinct_id
  // so the phone-side signup can stitch back to the desktop-side exposure.
  useEffect(() => {
    if (!posthog) return;
    const did = posthog.get_distinct_id?.();
    if (!did) return;
    const target = `${window.location.origin}/signup?from=qr&ph_did=${encodeURIComponent(did)}`;
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(target)}`);
  }, [posthog]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    setSubmitting(true);

    try {
      // Identify the user so the exposure (anonymous) gets stitched to the
      // identified person record before the conversion event fires.
      posthog?.identify(email, { signup_source: 'get_started_form' });

      // Conversion event. Includes the assigned variant for explicit attribution.
      posthog?.capture('user_signed_up', {
        signup_method: 'web_form',
        source: 'get_started',
        [`$feature/${FLAG_KEY}`]: variant,
      });

      toast.success('Welcome to Hogflix! Check your email to confirm.');
      setTimeout(() => navigate('/pricing'), 1200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <Header />
      <main className="container mx-auto max-w-4xl px-6 pt-20 pb-24">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-widest text-red-500 mb-4">Hogflix Premium</p>
          <h1 className="text-5xl font-bold mb-4">Start streaming in seconds</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Unlimited movies, shows, and live events. Cancel anytime.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          {variant === 'qr' ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
                <Smartphone className="w-4 h-4" />
                Continue on mobile for the best experience
              </div>

              {qrUrl ? (
                <div className="bg-white p-4 rounded-xl inline-block mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="Scan to continue" width={240} height={240} />
                </div>
              ) : (
                <div className="w-[272px] h-[272px] mx-auto bg-zinc-800 animate-pulse rounded-xl mb-6" />
              )}

              <p className="text-sm text-gray-400 mb-6">
                Scan with your phone camera to continue signing up on your mobile device.
              </p>

              <div className="border-t border-zinc-800 pt-6">
                <p className="text-xs text-gray-500 mb-3">Or sign up on this device</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    posthog?.capture('get_started_qr_fallback_clicked', {
                      [`$feature/${FLAG_KEY}`]: variant,
                    });
                    navigate('/signup');
                  }}
                >
                  Continue with email
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : (
            // Default to `form` variant for control or unassigned
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4" />
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-zinc-800 border-zinc-700"
                  disabled={submitting}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base bg-red-600 hover:bg-red-700"
                disabled={submitting}
              >
                {submitting ? 'Creating account...' : 'Start watching free'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-gray-500">
                <Lock className="w-3 h-3 inline mr-1" />
                Encrypted. No commitment. Cancel anytime.
              </p>
            </form>
          )}
        </div>

        {/* Tiny variant indicator for demo/debug. Remove or hide via flag for prod. */}
        {variant && (
          <p className="text-center mt-8 text-xs text-zinc-600">
            experiment variant: <code className="text-zinc-500">{variant}</code>
          </p>
        )}
      </main>
    </div>
  );
};

export default GetStarted;
