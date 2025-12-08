import posthog from 'posthog-js';

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
 * Sync CDP properties to PostHog person
 */
export function syncCDPProperties(email: string): boolean {
  if (!posthog.__loaded) {
    console.warn('PostHog not loaded');
    return false;
  }

  const profile = getDemoProfile(email);
  if (!profile) {
    console.warn(`No CDP demo profile found for: ${email}`);
    return false;
  }

  const properties = {
    ...profile,
    cdp_synced_at: new Date().toISOString(),
  };

  posthog.people.set(properties);
  
  // Track the sync event
  posthog.capture('cdp_demo:synced', {
    email,
    properties_synced: CDP_PROPERTY_KEYS,
  });

  console.log('CDP properties synced:', properties);
  return true;
}

/**
 * Clear CDP properties from PostHog person
 */
export function clearCDPProperties(): void {
  if (!posthog.__loaded) {
    console.warn('PostHog not loaded');
    return;
  }

  // Set all CDP properties to null to clear them
  const clearProperties: Record<string, null> = {};
  CDP_PROPERTY_KEYS.forEach(key => {
    clearProperties[key] = null;
  });
  posthog.people.set(clearProperties);

  // Track the clear event
  posthog.capture('cdp_demo:cleared', {
    properties_cleared: CDP_PROPERTY_KEYS,
  });

  console.log('CDP properties cleared');
}

/**
 * Get list of available demo emails
 */
export function getDemoEmails(): string[] {
  return Object.keys(CDP_DEMO_PROFILES);
}
