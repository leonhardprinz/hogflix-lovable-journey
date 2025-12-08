import { useState } from 'react';
import posthog from 'posthog-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Heart, Gift, X } from 'lucide-react';

interface RetentionOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
  currentPlan: string;
}

export function RetentionOfferModal({
  open,
  onOpenChange,
  onAccept,
  onDecline,
  currentPlan,
}: RetentionOfferModalProps) {
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    posthog.capture('retention_offer:accepted', {
      current_plan: currentPlan,
      discount_percent: 30,
      discount_duration_months: 3,
    });
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    onAccept();
    setIsAccepting(false);
  };

  const handleDecline = () => {
    posthog.capture('retention_offer:declined', {
      current_plan: currentPlan,
    });
    onDecline();
  };

  // Track when modal is shown
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      posthog.capture('retention_offer:shown', {
        current_plan: currentPlan,
      });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-background via-background to-primary/5 border-primary/20">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            Wait! We have something special for you 🦔
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            As a valued <span className="text-primary font-semibold">VIP member</span>, we'd hate to see you go.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 p-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 relative overflow-hidden">
          {/* Sparkle decorations */}
          <Sparkles className="absolute top-2 right-2 w-5 h-5 text-primary/40" />
          <Sparkles className="absolute bottom-2 left-2 w-4 h-4 text-primary/30" />
          
          <div className="text-center space-y-3">
            <Badge variant="secondary" className="bg-primary text-primary-foreground px-4 py-1">
              <Gift className="w-4 h-4 mr-1" />
              EXCLUSIVE VIP OFFER
            </Badge>
            
            <div className="space-y-1">
              <p className="text-4xl font-bold text-primary">30% OFF</p>
              <p className="text-muted-foreground">for the next 3 months</p>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Keep your <span className="font-medium text-foreground">{currentPlan}</span> plan at a discounted rate
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleAccept} 
            className="w-full h-12 text-lg font-semibold"
            disabled={isAccepting}
          >
            {isAccepting ? (
              <>Processing...</>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Keep My Plan with 30% Off
              </>
            )}
          </Button>
          
          <button
            onClick={handleDecline}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            No thanks, continue downgrading
          </button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-2">
          This offer is personalized based on your membership status and viewing history.
        </p>
      </DialogContent>
    </Dialog>
  );
}
