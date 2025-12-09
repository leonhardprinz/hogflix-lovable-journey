import posthog from 'posthog-js';

// PostHog configuration from environment
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_KEY;

export interface CDPProperties {
  customer_health_score: number;
  lifetime_value: number;
  is_vip: boolean;
  power_user_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  videos_watched_external: number;
  subscription_months: number;
  cdp_synced_at: string;
}

// Demo profiles matching R2 customer-profiles.json
const CDP_DEMO_PROFILES: Record<string, CDPProperties> = {
  'leo@posthog.com': {
    customer_health_score: 35,
    lifetime_value: 2847,
    is_vip: true,
    power_user_tier: 'gold',
    videos_watched_external: 156,
    subscription_months: 18,
    cdp_synced_at: '',
  },
  'leonhardprinz@gmail.com': {
    customer_health_score: 42,
    lifetime_value: 1923,
    is_vip: true,
    power_user_tier: 'platinum',
    videos_watched_external: 234,
    subscription_months: 24,
    cdp_synced_at: '',
  },
};

// CDP property keys for clearing
const CDP_PROPERTY_KEYS = [
  'customer_health_score',
  'lifetime_value',
  'is_vip',
  'power_user_tier',
  'videos_watched_external',
  'subscription_months',
  'cdp_synced_at',
];

/**
 * Check if email has a demo profile
 */
export function hasDemoProfile(email: string): boolean {
  return email.toLowerCase() in CDP_DEMO_PROFILES;
}

/**
 * Get demo profile for email
 */
export function getDemoProfile(email: string): CDPProperties | null {
  return CDP_DEMO_PROFILES[email.toLowerCase()] || null;
}

/**
 * Sync CDP properties to PostHog person via direct Capture API
 */
export async function syncCDPProperties(email: string): Promise<boolean> {
  const profile = getDemoProfile(email);
  if (!profile) {
    console.warn(`No CDP demo profile found for: ${email}`);
    return false;
  }

  if (!POSTHOG_API_KEY) {
    console.error('PostHog API key not configured');
    return false;
  }

  // CRITICAL: Get the ACTUAL distinct_id from PostHog (Supabase UUID)
  // NOT the email - email is only used to lookup the demo profile
  const distinctId = posthog.__loaded ? posthog.get_distinct_id() : null;
  
  if (!distinctId) {
    console.error('No distinct_id found - user may not be identified in PostHog');
    return false;
  }

  const properties = {
    is_vip: profile.is_vip,
    customer_health_score: profile.customer_health_score,
    power_user_tier: profile.power_user_tier,
    lifetime_value: profile.lifetime_value,
    videos_watched_external: profile.videos_watched_external,
    subscription_months: profile.subscription_months,
    cdp_synced_at: new Date().toISOString(),
  };

  try {
    // Direct call to PostHog Capture API with $set event
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        distinct_id: distinctId,  // Use actual PostHog distinct_id (UUID)
        event: '$set',
        properties: {
          $set: properties
        }
      })
    });

    if (!response.ok) {
      console.error('Failed to sync to PostHog:', await response.text());
      return false;
    }

    // Also register as super properties for immediate feature flag evaluation
    if (posthog.__loaded) {
      posthog.register(properties);
    }

    console.log('✅ CDP properties synced via Capture API:', properties);
    return true;
  } catch (error) {
    console.error('Error syncing CDP properties:', error);
    return false;
  }
}

/**
 * Clear CDP properties from PostHog person via direct Capture API
 */
export async function clearCDPProperties(): Promise<void> {
  if (!POSTHOG_API_KEY) {
    console.error('PostHog API key not configured');
    return;
  }

  // Get current user's distinct_id from PostHog
  const distinctId = posthog.__loaded ? posthog.get_distinct_id() : null;
  
  if (!distinctId) {
    console.warn('No distinct_id found to clear properties');
    return;
  }

  const clearProperties: Record<string, null> = {};
  CDP_PROPERTY_KEYS.forEach(key => {
    clearProperties[key] = null;
  });

  try {
    // Direct call to PostHog Capture API to clear properties
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        distinct_id: distinctId,
        event: '$set',
        properties: {
          $set: clearProperties
        }
      })
    });

    if (!response.ok) {
      console.error('Failed to clear PostHog properties:', await response.text());
      return;
    }

    // Clear super properties locally
    if (posthog.__loaded) {
      CDP_PROPERTY_KEYS.forEach(key => {
        posthog.unregister(key);
      });
    }

    console.log('✅ CDP properties cleared via Capture API');
  } catch (error) {
    console.error('Error clearing CDP properties:', error);
  }
}

/**
 * Get list of available demo emails
 */
export function getDemoEmails(): string[] {
  return Object.keys(CDP_DEMO_PROFILES);
}
