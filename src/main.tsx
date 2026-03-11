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
      api_host: import.meta.env.VITE_POSTHOG_HOST || '/ingest',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_web_experiments: false,
      debug: import.meta.env.DEV, // Enable debug logging in dev
      
      // Enable session recording (session replay)
      session_recording: {
        recordCrossOriginIframes: false,
        maskAllInputs: false,
        maskTextSelector: '.sensitive',
      } as any,
      
      // Log request errors (helps debug /flags failures)
      on_request_error: (error: any) => {
        console.error('🚨 PostHog request error:', error);
      },
      
      loaded: (posthog) => {
        console.log('==========================================')
        console.log('📊 PostHog Initialization Debug Info:')
        console.log('✅ PostHog loaded successfully')
        console.log('🔑 API Key:', import.meta.env.VITE_POSTHOG_KEY?.substring(0, 15) + '...')
        console.log('🌐 API Host:', import.meta.env.VITE_POSTHOG_HOST)
        console.log('🆔 Session ID:', posthog.get_session_id())
        console.log('📹 sessionRecording object exists:', !!posthog.sessionRecording)
        console.log('📹 sessionRecording status:', posthog.sessionRecording?.status)
        console.log('🪟 window.posthog exists:', !!(window as any).posthog)
        
        // Log autocapture status
        const ac = (posthog as any).autocapture;
        console.log('🖱️ Autocapture object exists:', !!ac);
        console.log('🖱️ Autocapture._initialized:', ac?._initialized);
        console.log('🖱️ Autocapture.isEnabled:', typeof ac?.isEnabled === 'function' ? ac.isEnabled() : 'N/A');
        console.log('🚩 featureFlags.hasLoadedFlags:', (posthog as any).featureFlags?.hasLoadedFlags);
        console.log('==========================================')
        
        // Register session-level super properties
        posthog.register({
          app_version: '1.0.0',
          environment: import.meta.env.MODE,
          platform: 'web',
          device_type: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        });

        // Set browser language as person property for survey targeting
        // This enables language-based survey targeting (e.g., show Japanese surveys to Japanese users)
        const browserLanguage = navigator.language || navigator.languages?.[0] || 'en';
        const languageCode = browserLanguage.split('-')[0]; // e.g., "ja" from "ja-JP"

        // Set as person property (survives across sessions)
        posthog.setPersonProperties({
          locale: browserLanguage,        // e.g., "ja-JP", "en-US"
          language: languageCode,         // e.g., "ja", "en"
          browser_languages: navigator.languages // Full list of user's preferred languages
        });

        console.log('🌍 Language properties set:', {
          locale: browserLanguage,
          language: languageCode,
          browser_languages: navigator.languages
        });
        
        // FORCE start session recording
        if (posthog.sessionRecording) {
          posthog.startSessionRecording()
          console.log('✅ Session recording FORCE STARTED')
          console.log('📹 Recording status after start:', posthog.sessionRecording.status)
        } else {
          console.error('❌ Session recording object is NULL')
        }
        
        // Fallback: Force-start autocapture if /flags didn't enable it after 3s
        setTimeout(() => {
          const autocapture = (posthog as any).autocapture;
          if (autocapture && !autocapture._initialized) {
            console.warn('⚠️ Autocapture not initialized after 3s - forcing start');
            // Override the server-side disable flag
            if (typeof autocapture._isDisabledServerSide !== 'undefined') {
              autocapture._isDisabledServerSide = false;
            }
            // Start autocapture manually
            if (typeof autocapture.startIfEnabled === 'function') {
              autocapture.startIfEnabled();
              console.log('✅ Autocapture FORCE STARTED');
              posthog.capture('autocapture_forced_start', { reason: 'flags_timeout' });
            }
          } else if (autocapture?._initialized) {
            console.log('✅ Autocapture already initialized normally');
          }
        }, 3000);
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
  );
  
  // Explicitly expose posthog on window for toolbar
  (window as any).posthog = posthog;

  // React Router can strip the #__posthog hash before posthog-js reads it
  try {
    const hash = window.location.hash.substring(1);
    const toolbarJSON = new URLSearchParams(hash).get('__posthog');
    if (toolbarJSON) {
      posthog.loadToolbar(JSON.parse(toolbarJSON));
    }
  } catch (e) {
    console.warn('PostHog toolbar hash parsing failed:', e);
  }

  // Allow toolbar loading via ?toolbar for demos
  try {
    if (new URLSearchParams(window.location.search).has('toolbar')) {
      posthog.loadToolbar({ token: import.meta.env.VITE_POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh' });
    }
  } catch (e) {
    console.warn('PostHog toolbar fallback failed:', e);
  }
}

// Pass the initialized posthog instance via client prop
createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
