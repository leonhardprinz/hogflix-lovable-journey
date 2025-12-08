import { useState, useEffect } from 'react';
import posthog from 'posthog-js';
import { X, Sparkles, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'hogflix_power_user_badge_dismissed';

interface PowerUserBadgeProps {
  className?: string;
}

export function PowerUserBadge({ className = '' }: PowerUserBadgeProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check localStorage for dismissed state
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed !== 'true') {
      setIsDismissed(false);
      // Animate in after a short delay
      setTimeout(() => setIsVisible(true), 100);
      
      // Track badge shown
      posthog.capture('power_user_badge:shown');
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    posthog.capture('power_user_badge:dismissed');
    
    // Wait for animation then hide
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 300);
  };

  const handleClick = () => {
    posthog.capture('power_user_badge:clicked');
  };

  if (isDismissed) return null;

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg
        bg-gradient-to-r from-amber-500/20 via-primary/20 to-purple-500/20
        border border-primary/30
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        ${className}
      `}
    >
      {/* Animated background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      
      <div className="relative flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Icon cluster */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-primary flex items-center justify-center">
              <Star className="w-5 h-5 text-white fill-white" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          
          {/* Text content */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Power User: Early Access Enabled</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              You've unlocked exclusive beta features based on your viewing activity!
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleClick}
            className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Explore Features
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
