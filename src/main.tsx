import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PostHogProvider } from 'posthog-js/react'

const options = {
  api_host: 'https://eu.i.posthog.com',
  person_profiles: 'identified_only' as const, // Fixed TypeScript typing
}

createRoot(document.getElementById("root")!).render(
  <PostHogProvider 
    apiKey="phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh" 
    options={options}
  >
    <App />
  </PostHogProvider>
);
