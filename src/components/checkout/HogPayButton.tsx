import { useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

// HogPay rides on the browser Payment Request API, the same way Google Pay and Apple Pay do on the web.
const HOGPAY_METHODS: PaymentMethodData[] = [{ supportedMethods: 'https://hogpay.hogflix.app/pay' }];

type Props = {
  plan: string;
  amount: number;
  disabled?: boolean;
  onApproved: () => void;
};

export const HogPayButton = ({ plan, amount, disabled, onApproved }: Props) => {
  const posthog = usePostHog();
  const [opening, setOpening] = useState(false);

  const openWallet = async () => {
    setOpening(true);
    posthog?.capture('checkout:wallet_clicked', { plan, wallet: 'hogpay' });
    try {
      const request = new PaymentRequest(HOGPAY_METHODS, {
        total: { label: 'HogFlix', amount: { currency: 'EUR', value: String(amount ?? 0) } },
      });
      await request.canMakePayment();
      onApproved();
    } catch {
      // shopper closed the wallet sheet
    } finally {
      setOpening(false);
    }
  };

  return (
    <Button
      onClick={openWallet}
      disabled={disabled || opening}
      className="w-full h-12 bg-black text-white hover:bg-black/90 text-base font-semibold"
      data-attr="hogpay-button"
    >
      {opening ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <span className="mr-2">🦔</span>}
      Buy with HogPay
    </Button>
  );
};
