import { useState, useEffect } from 'react';
import posthog from 'posthog-js';
import { X, Radio, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'hogflix_vip_livestream_banner_dismissed';

interface VipLivestreamBannerProps {
  className?: string;
}

export function VipLivestreamBanner({ className = '' }: VipLivestreamBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed !== 'true') {
      setIsDismissed(false);
      setTimeout(() => setIsVisible(true), 100);
      posthog.capture('vip_banner:shown');
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    posthog.capture('vip_banner:dismissed');
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 300);
  };

  const handleClick = () => {
    posthog.capture('vip_banner:clicked');
  };

  if (isDismissed) return null;

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg
        bg-gradient-to-r from-purple-600/30 via-red-500/20 to-amber-500/30
        border border-amber-400/40
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        ${className}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

      <div className="relative flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white fill-white" />
            </div>
            <Radio className="absolute -top-1 -right-1 w-4 h-4 text-red-400 animate-pulse" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Welcome, VIP!</span>
              <span className="text-xs bg-red-500/80 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold animate-pulse">Live</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your exclusive livestream is starting now — don't miss it!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClick}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-400/30"
            asChild
          >
            <a href="#livestream">
              <Radio className="w-4 h-4 mr-1" />
              Go to Livestream
            </a>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
