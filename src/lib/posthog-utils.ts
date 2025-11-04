import posthog from 'posthog-js';

export interface UserProperties {
  subscription_plan?: string;
  subscription_status?: string;
  lifecycle_state?: 'new' | 'active' | 'returning' | 'at_risk' | 'churned';
  total_watch_minutes?: number;
  videos_watched_count?: number;
  videos_completed_count?: number;
  last_active_at?: string;
  flixbuddy_user?: boolean;
  watchlist_count?: number;
  avg_rating?: number;
}

/**
 * Update user-level properties in PostHog
 * These persist across sessions and are used for segmentation
 */
export const updateUserProperties = (properties: UserProperties) => {
  if (!posthog.__loaded) return;
  
  // Set user properties
  posthog.people.set(properties);
  
  // Also register as super properties for event context
  const superProps: Record<string, any> = {};
  if (properties.subscription_plan) superProps.subscription_plan = properties.subscription_plan;
  if (properties.lifecycle_state) superProps.lifecycle_state = properties.lifecycle_state;
  
  posthog.register(superProps);
};

/**
 * Calculate lifecycle state based on activity
 */
export const calculateLifecycleState = (
  lastActiveAt: Date | null,
  videosWatched: number
): UserProperties['lifecycle_state'] => {
  if (videosWatched === 0) return 'new';
  
  if (!lastActiveAt) return 'new';
  
  const daysSinceActive = Math.floor(
    (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceActive > 30) return 'churned';
  if (daysSinceActive > 14) return 'at_risk';
  if (daysSinceActive > 7) return 'returning';
  
  return 'active';
};

/**
 * Track subscription change
 */
export const trackSubscriptionChange = (
  planName: string,
  status: string,
  features: string[]
) => {
  updateUserProperties({
    subscription_plan: planName,
    subscription_status: status,
    last_active_at: new Date().toISOString(),
  });
};

/**
 * Track video completion - pass current totals
 */
export const trackVideoCompletion = (
  totalCompletedCount: number,
  totalWatchMinutes: number
) => {
  updateUserProperties({
    videos_completed_count: totalCompletedCount,
    total_watch_minutes: totalWatchMinutes,
    last_active_at: new Date().toISOString(),
  });
};

/**
 * Track video started - pass current total
 */
export const trackVideoStarted = (totalWatchedCount: number) => {
  updateUserProperties({
    videos_watched_count: totalWatchedCount,
    last_active_at: new Date().toISOString(),
  });
};

/**
 * Track watchlist changes
 */
export const trackWatchlistChange = (
  action: 'added' | 'removed',
  videoId: string,
  newCount: number
) => {
  updateUserProperties({
    watchlist_count: newCount,
    last_active_at: new Date().toISOString()
  });
};

/**
 * Track profile group
 */
export const setProfileGroup = (profile: {
  id: string;
  display_name: string | null;
  is_kids_profile: boolean;
  user_id: string;
}) => {
  if (!posthog.__loaded) return;
  
  posthog.group('profile', profile.id, {
    display_name: profile.display_name,
    is_kids_profile: profile.is_kids_profile,
    user_id: profile.user_id
  });
};

/**
 * Initialize user properties on login
 */
export const initializeUserProperties = async (
  userId: string,
  email: string,
  subscription?: { plan_name: string; status: string }
) => {
  const baseProperties: UserProperties = {
    last_active_at: new Date().toISOString(),
    lifecycle_state: 'active',
  };
  
  if (subscription) {
    baseProperties.subscription_plan = subscription.plan_name;
    baseProperties.subscription_status = subscription.status;
  }
  
  updateUserProperties(baseProperties);
};
