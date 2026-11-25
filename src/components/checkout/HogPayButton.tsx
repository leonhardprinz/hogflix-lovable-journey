import { useEffect, useRef, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

// HogPay rides on the browser Payment Request API, the same way Google Pay and Apple Pay do on the web.
const hogPayMethods = (): PaymentMethodData[] => [{ supportedMethods: `${window.location.origin}/hogpay` }];

// Android WebViews and social in-app browsers (Facebook, Instagram) don't expose PaymentRequest at all.
const paymentRequestSupported = () => typeof window !== 'undefined' && typeof window.PaymentRequest === 'function';

type Props = {
  plan: string;
  amount: number;
  disabled?: boolean;
  onApproved: () => void;
};

export const HogPayButton = ({ plan, amount, disabled, onApproved }: Props) => {
  const posthog = usePostHog();
  const [supported] = useState(paymentRequestSupported);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const unavailableReported = useRef(false);

  useEffect(() => {
    if (supported || unavailableReported.current) return;
    unavailableReported.current = true;
    posthog?.capture('checkout:wallet_unavailable', {
      plan,
      wallet: 'hogpay',
      reason: 'payment_request_unsupported',
    });
  }, [supported, posthog, plan]);

  const openWallet = async () => {
    setOpening(true);
    posthog?.capture('checkout:wallet_clicked', { plan, wallet: 'hogpay' });
    try {
      new PaymentRequest(hogPayMethods(), {
        total: { label: 'HogFlix', amount: { currency: 'EUR', value: String(amount ?? 0) } },
      });
      // demo wallet: the sheet approves straight away
      onApproved();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      posthog?.captureException(err, {
        plan,
        payment_method: 'hogpay',
        checkout_stage: 'wallet_open',
        wallet_error_name: err.name,
        $exception_fingerprint: ['HogPayWalletError', err.name],
      });
      setFailed(true);
    } finally {
      setOpening(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="mb-6">
      {failed ? (
        <p role="alert" className="text-sm text-center text-muted-foreground border rounded-md p-3">
          HogPay couldn't open in this browser. Please choose another way to pay below.
        </p>
      ) : (
        <>
          <Button
            onClick={openWallet}
            disabled={disabled || opening}
            className="w-full h-12 bg-black text-white hover:bg-black/90 text-base font-semibold"
            data-attr="hogpay-button"
          >
            {opening ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <span className="mr-2">🦔</span>}
            Buy with HogPay
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">or choose another way to pay</p>
        </>
      )}
    </div>
  );
};
