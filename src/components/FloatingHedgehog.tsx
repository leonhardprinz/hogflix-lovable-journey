// Floating Hedgehog Widget for Global FlixBuddy Access
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { Button } from '@/components/ui/button';
import { Bot, MessageCircle, X } from 'lucide-react';

const FloatingHedgehog = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);
  const [flagVariant, setFlagVariant] = useState<string>('control');
  const navigate = useNavigate();
  const location = useLocation();
  const posthog = usePostHog();

  // Feature Flag: Control widget visibility - ALL HOOKS MUST BE CALLED BEFORE ANY RETURNS
  useEffect(() => {
    // Don't evaluate flag on FlixBuddy page
    if (location.pathname === '/flixbuddy') {
      setShouldShow(false);
      return;
    }

    posthog.onFeatureFlags(() => {
      const flagKey = 'FloatingHedgehog_Widget_Visibility_UXUI_Test';
      const variant = posthog.getFeatureFlag(flagKey) as string;
      setFlagVariant(variant || 'control');

      // Determine if widget should show based on variant
      let showWidget = false;
      if (variant === 'show_all') {
        showWidget = true;
      } else if (variant === 'show_on_pages') {
        // Show only on Browse, MyList, and Index pages
        const allowedPages = ['/', '/browse', '/mylist'];
        showWidget = allowedPages.includes(location.pathname);
      } else if (variant === 'hide_all') {
        showWidget = false;
      } else {
        // Control/default: show on all pages
        showWidget = true;
      }

      setShouldShow(showWidget);

      // Fire impression event when widget is shown
      if (showWidget) {
        posthog.capture('floatinghedgehog_impression', {
          variant: variant || 'control',
          current_page: location.pathname,
          timestamp: new Date().toISOString()
        });
      }
    });
  }, [location.pathname, posthog]);

  // Don't render until flag is evaluated or if flag determined we shouldn't
  if (shouldShow === null || !shouldShow) {
    return null;
  }

  const handleClick = () => {
    setIsClicked(true);
    
    // Track widget click with feature flag context
    posthog.capture('flixbuddy_click_through', {
      variant: flagVariant,
      current_page: location.pathname,
      timestamp: new Date().toISOString()
    });

    // Navigate to FlixBuddy
    navigate('/flixbuddy');
    
    // Reset click state after navigation
    setTimeout(() => setIsClicked(false), 200);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <div className="relative">
        {/* Pulse animation ring */}
        <div className={`absolute inset-0 rounded-full bg-primary/30 animate-ping ${
          isHovered ? 'scale-110' : 'scale-100'
        } transition-transform duration-300`} />
        
        {/* Main hedgehog button */}
        <Button
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          data-flixbuddy="open"
          className={`relative w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 ${
            isHovered ? 'scale-110' : 'scale-100'
          } ${
            isClicked ? 'scale-95' : ''
          }`}
          size="sm"
        >
          <div className="flex items-center justify-center">
            {/* Hedgehog Icon - Using Bot for now, easily replaceable */}
            <Bot className={`h-6 w-6 transition-transform duration-300 ${
              isHovered ? 'rotate-12' : 'rotate-0'
            }`} />
          </div>
        </Button>

        {/* Tooltip/Label */}
        <div className={`absolute left-16 top-1/2 -translate-y-1/2 bg-background border border-border rounded-lg px-3 py-2 shadow-lg transition-all duration-300 ${
          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
        }`}>
          <div className="flex items-center space-x-2 whitespace-nowrap">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Chat with FlixBuddy</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Get AI movie recommendations
          </div>
        </div>

        {/* Speech bubble indicator (optional) */}
        {!isHovered && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center animate-bounce">
            <MessageCircle className="h-2 w-2 text-primary-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingHedgehog;