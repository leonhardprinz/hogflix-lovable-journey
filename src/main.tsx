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
