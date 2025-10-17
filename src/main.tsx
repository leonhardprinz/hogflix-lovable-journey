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
  
  // Drop synthetic demo events before they are sent to PostHog
  before_send: (event: any) => {
    const props = event?.properties || {};
    
    // Check if event is from synthetic traffic
    const isSynthetic = 
      props?.synthetic === true || 
      props?.is_synthetic === true ||
      props?.$current_url?.includes('synthetic=1') ||
      props?.source === 'hogflix-bot';
    
    // Check if event is related to PostHog Demo category
    const isDemo = 
      props?.category === 'PostHog Demo' ||
      props?.$pathname?.includes('/demos') ||
      props?.$current_url?.includes('/demos') ||
      event?.event?.includes('demo_video');
    
    // Block synthetic demo events
    if (isSynthetic && isDemo) {
      console.log('🚫 Blocked synthetic demo event:', event.event);
      return null; // Drop the event
    }
    
    return event; // Allow all other events
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
