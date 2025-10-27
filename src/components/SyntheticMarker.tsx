import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

export default function SyntheticMarker() {
  const posthog = usePostHog()
  
  useEffect(() => {
    // Check URL parameters for synthetic traffic markers
    const qs = new URLSearchParams(location.search)
    const isSynthetic = qs.get('synthetic') === '1' || qs.get('syn') === '1'
    
    // Check sessionStorage for persistence across page refreshes
    const wasSynthetic = sessionStorage.getItem('hogflix_synthetic') === 'true'
    
    if (isSynthetic || wasSynthetic) {
      // Register event-level super properties for this entire session
      posthog.register({ 
        synthetic: true, 
        is_synthetic: true, 
        source: 'hogflix-bot' 
      })
      
      // Persist flag in sessionStorage for page refreshes
      if (isSynthetic && !wasSynthetic) {
        sessionStorage.setItem('hogflix_synthetic', 'true')
        if (import.meta.env.DEV) {
          console.log('🤖 Synthetic session registered in PostHog')
        }
      }
    }
  }, [posthog])
  
  return null // No visual output
}
