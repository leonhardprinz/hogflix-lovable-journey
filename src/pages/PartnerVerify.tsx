import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';

/**
 * /partner-verify
 *
 * Simulated third-party identity-verification page. Stands in for
 * Digilocker / HyperVerge VKYC / Stripe / any cross-domain handoff.
 * Visually distinct from hogflix so a viewer immediately knows
 * "we are on the partner's site now."
 *
 * Reads the return URL + outcome routing from the query string.
 * On Approve / Decline / Cancel it redirects back to the return URL
 * with `?handoff_outcome=success|failure|cancelled&handoff_code=...`
 * — exactly the shape `detectHandoffReturn()` expects.
 */
const PartnerVerify = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState<null | 'success' | 'failure' | 'cancelled'>(null);

  const returnTo = searchParams.get('return_to') || '/signup';
  const partnerName = searchParams.get('partner') || 'Digilocker';

  const completeWith = (outcome: 'success' | 'failure' | 'cancelled', code: string) => {
    setProcessing(outcome);
    // Simulate the small async hop a real provider would do.
    setTimeout(() => {
      const url = new URL(returnTo, window.location.origin);
      url.searchParams.set('handoff_outcome', outcome);
      url.searchParams.set('handoff_code', code);
      navigate(`${url.pathname}${url.search}`);
    }, 900);
  };

  // Guard against direct visits without a return target.
  useEffect(() => {
    if (!searchParams.get('return_to')) {
      // eslint-disable-next-line no-console
      console.warn('PartnerVerify opened without ?return_to — defaulting to /signup');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 p-4">
      <Card className="max-w-md w-full p-8 bg-white border-2 border-blue-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              {partnerName} · Government Verified
            </div>
            <div className="text-lg font-bold text-slate-900">Identity Verification</div>
          </div>
        </div>

        <div className="space-y-4 text-slate-700">
          <p className="text-sm">
            <strong>HogFlix</strong> is requesting access to verify your identity through{' '}
            {partnerName}.
          </p>
          <p className="text-xs text-slate-500">
            This is a simulated third-party identity provider used to demonstrate cross-domain
            handoff tracking. No real verification is performed.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-1">
            <div>
              <span className="text-slate-500">Will be shared:</span>{' '}
              <span className="text-slate-900">Full name, DOB, Address</span>
            </div>
            <div>
              <span className="text-slate-500">Return URL:</span>{' '}
              <code className="text-blue-700">{returnTo}</code>
            </div>
          </div>

          {processing ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
              <div className="text-sm text-slate-600">
                Completing with outcome: <strong>{processing}</strong>…
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="bg-green-700 hover:bg-green-800 text-white"
                onClick={() => completeWith('success', 'KYC_OK_DL_001')}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve &amp; Return
              </Button>
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => completeWith('failure', 'KYC_FAIL_INVALID_DOC')}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Decline (simulate verification failure)
              </Button>
              <Button
                variant="ghost"
                className="text-slate-500"
                onClick={() => completeWith('cancelled', 'USER_CANCELLED')}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">
          Demo only — simulates a Digilocker / HyperVerge-style identity provider.
        </div>
      </Card>
    </div>
  );
};

export default PartnerVerify;
