import { useEffect, useRef, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';

interface RageClickOptions {
  threshold?: number; // Number of clicks to trigger rage click (default: 3)
  timeWindow?: number; // Time window in ms (default: 2000)
  elementSelector?: string; // CSS selector for debugging
}

interface ClickRecord {
  timestamp: number;
  x: number;
  y: number;
}

export const useRageClickDetection = (
  elementRef: React.RefObject<HTMLElement>,
  options: RageClickOptions = {}
) => {
  const posthog = usePostHog();
  const { threshold = 3, timeWindow = 2000, elementSelector } = options;
  
  const clickHistory = useRef<ClickRecord[]>([]);
  const rageClickDetected = useRef(false);

  const handleClick = useCallback((event: MouseEvent) => {
    const now = Date.now();
    
    // Add current click to history
    clickHistory.current.push({
      timestamp: now,
      x: event.clientX,
      y: event.clientY
    });

    // Remove clicks outside time window
    clickHistory.current = clickHistory.current.filter(
      click => now - click.timestamp < timeWindow
    );

    // Check if rage click threshold is met
    if (clickHistory.current.length >= threshold && !rageClickDetected.current) {
      rageClickDetected.current = true;
      
      const element = event.target as HTMLElement;
      const clickCount = clickHistory.current.length;
      const timeSpan = now - clickHistory.current[0].timestamp;

      // Capture rage click event
      posthog?.capture('rage_click', {
        element_selector: elementSelector || getElementSelector(element),
        element_text: element.textContent?.trim().substring(0, 50),
        element_id: element.id || null,
        element_class: element.className || null,
        click_count: clickCount,
        time_span_ms: timeSpan,
        page: window.location.pathname,
        page_url: window.location.href,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });

      console.warn(`🔴 Rage click detected: ${clickCount} clicks in ${timeSpan}ms`);

      // Reset after detection
      setTimeout(() => {
        rageClickDetected.current = false;
        clickHistory.current = [];
      }, timeWindow);
    }
  }, [posthog, threshold, timeWindow, elementSelector]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('click', handleClick as EventListener);

    return () => {
      element.removeEventListener('click', handleClick as EventListener);
      clickHistory.current = [];
      rageClickDetected.current = false;
    };
  }, [elementRef, handleClick]);

  return {
    clickCount: clickHistory.current.length,
    isRageClick: rageClickDetected.current
  };
};

// Helper to generate CSS selector for element
function getElementSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c).slice(0, 2).join('.');
    return element.tagName.toLowerCase() + (classes ? `.${classes}` : '');
  }
  
  return element.tagName.toLowerCase();
}
