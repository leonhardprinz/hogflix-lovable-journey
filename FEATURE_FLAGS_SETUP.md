# PostHog Feature Flags Setup Guide

This document describes the feature flags implemented in HogFlix and how to set them up in your PostHog instance.

## Implemented Feature Flags

### 1. `FloatingHedgehog_Widget_Visibility_UXUI_Test`
**Type:** Multivariate flag  
**Purpose:** Controls visibility of the FloatingHedgehog widget (AI assistant access button)

#### How to Create in PostHog:
1. Go to Feature Flags in your PostHog dashboard
2. Click "New Feature Flag"
3. **Key:** `FloatingHedgehog_Widget_Visibility_UXUI_Test`
4. **Name:** Floating Hedgehog Widget Visibility (UX/UI Test)
5. **Description:** Controls whether and where the floating FlixBuddy AI assistant button appears
6. **Flag Type:** Multiple variants (Multivariate)
7. **Variants:**
   - `show_all` (Control): Show widget on all pages
   - `show_on_pages` (Test A): Show widget only on Browse, MyList, and Index pages
   - `hide_all` (Test B): Hide widget completely
   - `control` (Fallback): Default behavior (show on all pages)
8. **Rollout:** Split evenly between variants for A/B/C testing

#### Analytics Events Tracked:
- `floatinghedgehog_impression` - When widget is displayed to user (includes variant, page context)
- `flixbuddy_click_through` - When user clicks the widget to open FlixBuddy (includes variant, page context)

#### Testing Strategy:
- **Variant A (show_all):** Widget visible on all pages
- **Variant B (show_on_pages):** Widget visible only on key pages (Browse, MyList, Index)
- **Variant C (hide_all):** Widget completely hidden
- **Success Metrics:** 
  - FlixBuddy click-through rate (CTR)
  - FlixBuddy page visit rate
  - User engagement with AI features
  - Page-specific widget performance
  - Overall session quality and navigation patterns

---

### 2. `Popular_vs_Trending_Priority_Algo_Test`
**Type:** Multivariate flag  
**Purpose:** A/B test the order of Popular vs Trending sections on the Browse page to determine optimal algorithm priority

#### How to Create in PostHog:
1. Go to Feature Flags in your PostHog dashboard
2. Click "New Feature Flag"
3. **Key:** `Popular_vs_Trending_Priority_Algo_Test`
4. **Name:** Popular vs Trending Priority (Algorithm Test)
5. **Description:** Tests whether Popular or Trending section should appear first on Browse page
6. **Flag Type:** Multiple variants (Multivariate)
7. **Variants:**
   - `popular-first` (Control): Popular section appears before Trending
   - `trending-first` (Test): Trending section appears before Popular
8. **Rollout:** Split 50/50 between variants for A/B testing

#### Analytics Events Tracked:
- `page:viewed_browse` - Includes `section_priority_variant` property
- `feature_flag:section_priority_impression` - When section order is determined
- `home_section_impression` - When user views a section (includes `section` and `position` properties)
- `home_section_click` - When user clicks video in a section (includes `section` property)
- `content_start` - When video playback begins (includes `source_section` context)
- `content_complete` - When video playback completes (includes `source_section`, `completion_pct`, and `watch_seconds`)

#### Testing Strategy:
- **Variant A (Control - popular-first):** Popular → Trending
- **Variant B (Test - trending-first):** Trending → Popular
- **Success Metrics:**
  - Click-through rate per section (home_section_click / home_section_impression)
  - Time to first video click
  - Overall engagement per variant
  - Watch completion rates per source section
  - Average watch duration per source section

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

### 4. `dynamic-onboarding`
**Type:** Multivariate flag with JSON payloads  
**Purpose:** Powers the Dynamic Onboarding demo at `/demo/dynamic-onboarding` - the onboarding welcome screen is rendered entirely from the flag's JSON payload, selected by person properties written from in-app behavior

#### How to Create in PostHog (project 85924, EU):
1. Go to Feature Flags in your PostHog dashboard
2. Click "New Feature Flag"
3. **Key:** `dynamic-onboarding`
4. **Name:** Dynamic Onboarding Experience
5. **Description:** Selects the onboarding welcome screen (headline, subline, CTA, content-row order) based on the person's computed onboarding segment and engagement score
6. **Flag Type:** Multiple variants (Multivariate)
7. **Variants:** `family` / `casual` / `cinephile` (rollout split does not matter - release conditions force the variant per segment)
8. **Release conditions** (each condition set forces one variant, order matters - most specific first):
   - **Set 1 → variant `family`:** person property `onboarding_segment` = `family`
   - **Set 2 → variant `cinephile`:** person property `onboarding_segment` = `cinephile` AND `engagement_score` ≥ `60`
   - **Set 3 → variant `casual`:** everyone else (100% of remaining users)
   - The `engagement_score` condition on Set 2 is the demo's talking point: a cinephile with low engagement falls through to `casual`, showing that conditions can combine segment AND score
9. **JSON payloads** (Variants tab → payload per variant):

`family`:
```json
{
  "headline": "Movie night, sorted for the whole family",
  "subline": "Kid-safe picks up front, parental controls on by default.",
  "cta": "Set up Kids profiles",
  "rows": ["Kids & Family", "Animated Favorites", "Watch Together", "Popular"]
}
```

`cinephile`:
```json
{
  "headline": "For people who read the credits",
  "subline": "Documentaries, director's cuts and festival winners first.",
  "cta": "Build my watchlist",
  "rows": ["Award-Winning Documentaries", "Critically Acclaimed", "Hidden Gems", "New Releases"]
}
```

`casual`:
```json
{
  "headline": "Something great is always on",
  "subline": "Jump straight into what everyone's watching right now.",
  "cta": "Play top pick",
  "rows": ["Trending Now", "Popular", "Quick Watches"]
}
```

#### Person Properties Written by the Demo:
- `onboarding_segment` - `family` | `cinephile` | `casual`, computed client-side from interest picks (kids → family, else documentaries → cinephile, else casual)
- `engagement_score` - 0–100, computed as `interests × 20 + (binge intent ? 40 : 0)`, capped at 100

Written via `posthog.setPersonProperties()` followed by `posthog.reloadFeatureFlags()` - posthog-js sends the `$set` alongside the /flags request, so the flag usually re-evaluates against the fresh values on that same refresh (the page shows the measured round-trip in ms).

#### Analytics Events Tracked:
- `onboarding_interest_selected` - Each interest button click (includes `interest`, `selected`, `total_selected`)
- `onboarding_binge_intent_toggled` - The "I watch daily" toggle (includes `binge_intent`)
- `onboarding_signal_written` - When the computed signal is written (includes `onboarding_segment`, `engagement_score`, `interests`, `binge_intent`)

#### Testing Strategy:
- With the flag off (or payload missing), the page renders a clearly-labeled "Static default" welcome screen - keep it off at first in the demo to show the contrast
- **Success Metrics (if run as a real experiment):**
  - Onboarding completion rate per variant
  - Time to first play from the welcome screen
  - D1/D7 retention per onboarding segment

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
// Multivariate flags with onFeatureFlags pattern
useEffect(() => {
  posthog.onFeatureFlags(() => {
    const flagKey = 'FloatingHedgehog_Widget_Visibility_UXUI_Test';
    const variant = posthog.getFeatureFlag(flagKey);
    // Use variant to control UI
  });
}, [posthog]);

// Direct multivariate flag check (for non-critical paths)
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
// Override floating hedgehog to show on all pages
posthog.featureFlags.override({'FloatingHedgehog_Widget_Visibility_UXUI_Test': 'show_all'});

// Override floating hedgehog to show only on specific pages
posthog.featureFlags.override({'FloatingHedgehog_Widget_Visibility_UXUI_Test': 'show_on_pages'});

// Override floating hedgehog to hide completely
posthog.featureFlags.override({'FloatingHedgehog_Widget_Visibility_UXUI_Test': 'hide_all'});

// Override section priority to trending-first
posthog.featureFlags.override({'Popular_vs_Trending_Priority_Algo_Test': 'trending-first'});

// Override section priority to popular-first (control)
posthog.featureFlags.override({'Popular_vs_Trending_Priority_Algo_Test': 'popular-first'});

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
