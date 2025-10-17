import { usePostHog } from 'posthog-js/react'

/**
 * Check if the current session is synthetic traffic.
 * Used to prevent synthetic sessions from polluting demo analytics.
 */
export function useSyntheticCheck() {
  const posthog = usePostHog()
  return (
    posthog.get_property('synthetic') === true ||
    posthog.get_property('is_synthetic') === true
  )
}
