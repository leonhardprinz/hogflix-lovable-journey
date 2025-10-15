import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface NewsletterOptInProps {
  email?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const NewsletterOptIn = ({ checked, onChange, disabled = false }: NewsletterOptInProps) => {
  return (
    <div className="flex items-start space-x-3 pt-2">
      <Checkbox
        id="newsletter-opt-in"
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <Label
        htmlFor="newsletter-opt-in"
        className="text-sm text-text-secondary cursor-pointer leading-relaxed"
      >
        Send me product tips, new content & offers (you can unsubscribe anytime)
      </Label>
    </div>
  );
};

export default NewsletterOptIn;
