import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PostHogProvider } from 'posthog-js/react'

const options = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
  person_profiles: 'identified_only' as const,
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  
  // Enable session recording (session replay)
  session_recording: {
    enabled: true,
    recordCrossOriginIframes: false, // Don't record iframes from other domains
    maskAllInputs: false, // Show form inputs (safe for demo)
    maskTextSelector: '.sensitive', // Mask elements with .sensitive class
  },
  
  loaded: (posthog: any) => {
    // Register session-level super properties
    posthog.register({
      app_version: '1.0.0',
      environment: import.meta.env.MODE,
      platform: 'web',
      device_type: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    });
    
    // Log PostHog initialization status
    console.log('✅ PostHog loaded successfully')
    console.log('📹 Session recording enabled:', posthog.config.session_recording?.enabled)
    console.log('🆔 Session ID:', posthog.get_session_id())
    
    // Verify session recording is active
    if (posthog.sessionRecording) {
      console.log('✅ Session recording initialized')
    } else {
      console.error('❌ Session recording failed to initialize')
    }
  },
  
  // Drop ONLY synthetic demo VIDEO events (not all synthetic traffic)
  before_send: (event: any) => {
    const props = event?.properties || {};
    
    // Check if event is from synthetic traffic
    const isSynthetic = 
      props?.synthetic === true || 
      props?.is_synthetic === true;
    
    // Check if event is related to the specific PostHog Demo VIDEO
    const isDemoVideo = 
      props?.video_id === '6f4d68aa-3d28-43eb-a16d-31848741832b' ||
      props?.category === 'PostHog Demo';
    
    // Block ONLY synthetic demo video events, allow all other synthetic traffic
    if (isSynthetic && isDemoVideo) {
      if (import.meta.env.DEV) {
        console.log('🚫 Blocked synthetic demo video event:', event.event);
      }
      return null; // Drop the event
    }
    
    return event; // Allow all other events including synthetic traffic
  },
}

createRoot(document.getElementById("root")!).render(
  <PostHogProvider 
    apiKey={import.meta.env.VITE_POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh'}
    options={options}
  >
    <App />
  </PostHogProvider>
);
