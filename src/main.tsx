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
    disable_web_experiments: false,
      
      // Enable session recording (session replay)
      session_recording: {
        recordCrossOriginIframes: false,
        maskAllInputs: false,
        maskTextSelector: '.sensitive',
      } as any,
      
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
        console.log('📊 Config:', JSON.stringify({
          api_host: posthog.config.api_host,
          autocapture: posthog.config.autocapture,
          session_recording: posthog.config.session_recording
        }, null, 2))
        console.log('==========================================')
        
        // Register session-level super properties
        posthog.register({
          app_version: '1.0.0',
          environment: import.meta.env.MODE,
          platform: 'web',
          device_type: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        });
        
        // FORCE start session recording
        if (posthog.sessionRecording) {
          posthog.startSessionRecording()
          console.log('✅ Session recording FORCE STARTED')
          console.log('📹 Recording status after start:', posthog.sessionRecording.status)
        } else {
          console.error('❌ Session recording object is NULL')
          console.error('   This means the /decide endpoint did not return session_recording config')
          console.error('   Check PostHog project settings: https://eu.posthog.com/settings/project-replay')
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
  );
  
  // Explicitly expose posthog on window for toolbar
  (window as any).posthog = posthog;
}

// Pass the initialized posthog instance via client prop
createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
