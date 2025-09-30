# PostHog Feature Flags Setup Guide

This document describes the feature flags implemented in HogFlix and how to set them up in your PostHog instance.

## Implemented Feature Flags

### 1. `floating-hedgehog-enabled`
**Type:** Boolean flag  
**Purpose:** Controls visibility of the FloatingHedgehog widget (AI assistant access button)

#### How to Create in PostHog:
1. Go to Feature Flags in your PostHog dashboard
2. Click "New Feature Flag"
3. **Key:** `floating-hedgehog-enabled`
4. **Name:** Floating Hedgehog Widget
5. **Description:** Controls whether the floating FlixBuddy AI assistant button appears on pages
6. **Flag Type:** Boolean
7. **Rollout:** Set to 100% for "enabled" or 0% for "disabled"

#### Analytics Events Tracked:
- `feature_flag:floating_hedgehog_disabled` - When flag is disabled and widget doesn't show
- `hedgehog_widget:impression` - When widget is displayed to user (includes page context)
- `hedgehog_widget:clicked` - When user clicks the widget (includes page context)

#### Testing Strategy:
- **Variant A (Control - Enabled):** Show widget on all pages
- **Variant B (Test - Disabled):** Hide widget completely
- **Success Metrics:** 
  - FlixBuddy page visit rate
  - User engagement with AI features
  - Overall session quality

---

### 2. `section-priority-test`
**Type:** Multivariate flag  
**Purpose:** A/B test the order of Popular vs Trending sections on the Browse page

#### How to Create in PostHog:
1. Go to Feature Flags in your PostHog dashboard
2. Click "New Feature Flag"
3. **Key:** `section-priority-test`
4. **Name:** Browse Section Priority Test
5. **Description:** Tests whether Popular or Trending section should appear first
6. **Flag Type:** Multiple variants (Multivariate)
7. **Variants:**
   - `popular-first` (Control): Popular section appears before Trending
   - `trending-first` (Test): Trending section appears before Popular
8. **Rollout:** Split 50/50 between variants for A/B testing

#### Analytics Events Tracked:
- `page:viewed_browse` - Includes `section_priority_variant` property
- `feature_flag:section_priority_impression` - When section order is determined
- `section:viewed` - When user hovers over a section (includes section name, position)
- `popular_section:video_clicked` - When user clicks video in Popular section
- `trending_section:video_clicked` - When user clicks video in Trending section

#### Testing Strategy:
- **Variant A (Control - popular-first):** Popular → Trending
- **Variant B (Test - trending-first):** Trending → Popular
- **Success Metrics:**
  - Click-through rate per section
  - Time to first video click
  - Overall engagement per variant
  - Watch completion rates

---

### 3. `new-player-ui`
**Type:** Boolean flag  
**Purpose:** Enhanced video player with advanced controls (already exists in codebase)

#### Status:
This flag already exists in the VideoPlayer component. The current implementation includes:
- Basic tracking in VideoPlayer.tsx
- Used for A/B testing player UI variations

#### Recommendations for Enhancement:
Consider adding these analytics events to track player variant performance:
- `player_ui:variant_loaded` - Which player UI version loaded
- `player_ui:control_used` - Track which controls users interact with
- `player_ui:completion_rate` - Compare completion rates between variants
- `player_ui:quality_changed` - Track quality selector usage (if implemented)
- `player_ui:speed_changed` - Track playback speed changes (if implemented)

---

## Analytics Event Naming Convention

All feature flag-related events follow this pattern:
```
{feature_name}:{action}
```

Common properties included:
- `timestamp` - ISO timestamp of event
- `profile_id` - Current user profile ID
- `current_page` - Current route/page path
- `{flag_name}_variant` - Which variant user is seeing

---

## Best Practices for Analysis

### 1. Floating Hedgehog Analysis
**Questions to Answer:**
- Does the widget increase or decrease FlixBuddy engagement?
- Does widget presence affect overall user experience?
- Are there pages where the widget performs better/worse?

**Key Metrics:**
```
- Widget Click-Through Rate = hedgehog_widget:clicked / hedgehog_widget:impression
- FlixBuddy Conversion = flixbuddy_page_visits / total_sessions
- Compare engagement metrics between enabled/disabled variants
```

### 2. Section Priority Analysis
**Questions to Answer:**
- Which section order drives more engagement?
- Do users prefer Popular or Trending content first?
- Does section order affect watch time or completion rates?

**Key Metrics:**
```
- Section CTR = section_video_clicks / section_impressions
- Time to First Click = time between page load and first video click
- Average position of clicked videos
- Engagement depth (scroll behavior, carousel interactions)
```

### 3. Cohort Creation
Create these cohorts in PostHog for deeper analysis:
- Users who saw floating hedgehog enabled
- Users who saw floating hedgehog disabled
- Users who saw popular-first ordering
- Users who saw trending-first ordering

---

## Implementation Details

### Feature Flag Evaluation
```typescript
// Boolean flags
const isEnabled = posthog.isFeatureEnabled('floating-hedgehog-enabled');

// Multivariate flags
const variant = posthog.getFeatureFlag('section-priority-test');
```

### Event Capture Pattern
```typescript
posthog.capture('event:name', {
  // Feature flag context
  variant: variant || 'control',
  
  // User context
  profile_id: selectedProfile?.id,
  current_page: location.pathname,
  
  // Event-specific data
  video_id: video.id,
  position: index + 1,
  
  // Timestamp
  timestamp: new Date().toISOString()
});
```

---

## Testing Checklist

Before launching feature flags to production:

- [ ] Create all feature flags in PostHog with correct keys
- [ ] Set appropriate rollout percentages (start with 10-20% for tests)
- [ ] Verify events are being captured in PostHog
- [ ] Create dashboards for real-time monitoring
- [ ] Set up alerts for unusual patterns
- [ ] Document expected behavior for each variant
- [ ] Plan test duration (minimum 2 weeks recommended)
- [ ] Define success criteria and decision thresholds

---

## Quick Setup Commands

To test feature flags locally, use PostHog's feature flag overrides in your browser console:
```javascript
// Override floating hedgehog to disabled
posthog.featureFlags.override({'floating-hedgehog-enabled': false});

// Override section priority to trending-first
posthog.featureFlags.override({'section-priority-test': 'trending-first'});

// Reset overrides
posthog.featureFlags.override(false);
```

---

## Questions or Issues?

If you encounter any issues with feature flag implementation:
1. Check PostHog console for flag evaluation errors
2. Verify flag keys match exactly (case-sensitive)
3. Ensure PostHog is properly initialized before flag evaluation
4. Check browser network tab for PostHog API calls

For more information on PostHog feature flags, visit:
https://posthog.com/docs/feature-flags
