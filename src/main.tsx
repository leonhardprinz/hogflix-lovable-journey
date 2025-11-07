import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

// Initialize PostHog BEFORE creating the provider
// This creates window.posthog which the Playwright script needs
if (typeof window !== 'undefined') {
  posthog.init(
    import.meta.env.VITE_POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
    {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      
      // Enable session recording (session replay)
      session_recording: {
        recordCrossOriginIframes: false,
        maskAllInputs: false,
        maskTextSelector: '.sensitive',
      } as any,
      
      loaded: (posthog) => {
        // Register session-level super properties
        posthog.register({
          app_version: '1.0.0',
          environment: import.meta.env.MODE,
          platform: 'web',
          device_type: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        });
        
        // Log PostHog initialization status
        console.log('✅ PostHog loaded successfully')
        console.log('📹 Session recording active:', !!posthog.sessionRecording)
        console.log('🆔 Session ID:', posthog.get_session_id())
        
        // Verify session recording is active
        if (posthog.sessionRecording) {
          console.log('✅ Session recording initialized')
          console.log('📹 window.posthog is available:', !!(window as any).posthog)
        } else {
          console.error('❌ Session recording failed to initialize')
        }
      },
      
      // Drop ONLY synthetic demo VIDEO events (not all synthetic traffic)
      before_send: (event) => {
        const props = event?.properties || {};
        
        const isSynthetic = 
          props?.synthetic === true || 
          props?.is_synthetic === true;
        
        const isDemoVideo = 
          props?.video_id === '6f4d68aa-3d28-43eb-a16d-31848741832b' ||
          props?.category === 'PostHog Demo';
        
        if (isSynthetic && isDemoVideo) {
          if (import.meta.env.DEV) {
            console.log('🚫 Blocked synthetic demo video event:', event.event);
          }
          return null;
        }
        
        return event;
      },
    }
  )
}

// Pass the initialized posthog instance via client prop
createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
