# Phase 1: Feature Flag Integration - IMPLEMENTED ✅

## Overview
Phase 1 of the organic synthetic traffic system has been implemented. Synthetic users now automatically adapt their behavior based on feature flags fetched from PostHog.

## What Was Implemented

### 1. Feature Flag Storage in Personas
- Added `feature_flags` object to store flag variants
- Added `feature_flags_last_fetched` timestamp for refresh logic
- Migrated existing personas to include new fields

### 2. Feature Flag Fetching System
- `fetchFeatureFlagsForPersona()`: Calls PostHog's `/decide` API to get feature flags for each persona
- `shouldRefreshFeatureFlags()`: Checks if flags need refreshing (every 24 hours)
- Integrated into main execution flow (Phase 5.5) after PostHog identification

### 3. Browser Journey Adaptations
**Returning User Journey (`playwright-journey-returning-user.js`):**
- Added feature flag helper functions:
  - `getFeatureFlag()`: Get flag value with default fallback
  - `shouldShowFloatingHedgehog()`: Check widget visibility flag
  - `getSectionPriority()`: Get section ordering variant
  - `hasEarlyAccessAISummaries()`: Check AI summary feature access
  
- **FlixBuddy Adaptation**: Only engages with FlixBuddy if `FloatingHedgehog_Widget_Visibility_UXUI_Test` is enabled
- **Section Priority Tracking**: Captures `section_priority_variant` in events based on `Popular_vs_Trending_Priority_Algo_Test` flag

### 4. Event Tracking Enhancements
- All relevant events now include feature flag context
- Events track which variant the user is experiencing
- Enables A/B test analysis in PostHog

## Feature Flags Integrated

| Flag Name | Purpose | Variants |
|-----------|---------|----------|
| `FloatingHedgehog_Widget_Visibility_UXUI_Test` | Controls FloatingHedgehog widget visibility | `show_all`, `show_on_pages`, `hide_all` |
| `Popular_vs_Trending_Priority_Algo_Test` | Controls section ordering on Browse page | `popular-first`, `trending-first`, `popular-only` |
| `early_access_ai_summaries` | AI summary panel feature access | `true`, `false` |
| `thumbnail-experiment` | Thumbnail A/B test | Various variants |
| `pricing_upgrade_cta_experiment` | Pricing page CTA test | Various variants |

## How It Works

1. **At Initialization**: When personas are created or loaded, they get empty `feature_flags` objects
2. **During Execution**: After PostHog identification (Phase 5), the system:
   - Checks if flags need refreshing (24hr TTL)
   - Fetches current flag variants from PostHog API
   - Stores variants in persona state
3. **During Sessions**: Browser journeys check flag values and adapt behavior:
   - Skip FlixBuddy if widget is hidden
   - Adjust section viewing patterns based on priority variant
   - Track flag context in all events

## Benefits

✅ **Self-Adapting**: Synthetic users automatically discover and adapt to new feature flags
✅ **Realistic A/B Tests**: Experiments show statistical significance with variant distribution
✅ **No Manual Updates**: No need to update scripts when adding/removing flags
✅ **Complete Context**: All events include feature flag information for analysis
✅ **Rate Limited**: Fetches flags in batches to respect API limits

## Usage

### Running with Feature Flags
```bash
# Synthetic traffic will automatically fetch and use feature flags
node scripts/synthetic-traffic.js
```

### Viewing Flag Data
Personas store flag data in `.synthetic_state/personas.json`:
```json
{
  "distinct_id": "p_00001_1234567890",
  "feature_flags": {
    "FloatingHedgehog_Widget_Visibility_UXUI_Test": "show_all",
    "Popular_vs_Trending_Priority_Algo_Test": "trending-first",
    "early_access_ai_summaries": true
  },
  "feature_flags_last_fetched": "2025-01-15T10:30:00.000Z"
}
```

### Analyzing in PostHog
1. Go to your experiment in PostHog
2. View results - synthetic users will be enrolled in variants
3. Filter by `is_synthetic: true` if needed to separate real/synthetic traffic
4. Check event properties for `section_priority_variant`, `feature_flag_variant`, etc.

## Next Steps - Future Phases

### Phase 2: Dynamic Content Discovery (Recommended Next)
- Query Supabase for new videos
- Weight content selection toward recent uploads
- Simulate trending content behavior

### Phase 3: Route/Page Discovery
- Parse sitemap or routes
- Automatically explore new pages
- Generate behavior for new page types

### Phase 4: AI-Powered Behavior Adaptation
- Use LLM to analyze DOM
- Generate realistic interactions for new features
- Fully autonomous adaptation

## Testing

To verify feature flag integration:

1. **Check Flag Fetching**:
   ```bash
   node scripts/synthetic-traffic.js
   # Look for: "🚩 Fetching feature flags for personas..."
   # Should see: "Fetched X feature flags for p_xxxxx"
   ```

2. **Verify in PostHog**:
   - Navigate to any experiment
   - Check if synthetic users appear in variant groups
   - View event properties to confirm flag context

3. **Test Flag Adaptation**:
   - Change a feature flag in PostHog
   - Wait for next synthetic run (or force refresh by clearing `feature_flags_last_fetched`)
   - Verify behavior changes (e.g., FlixBuddy interactions stop if widget is hidden)

## Troubleshooting

**Flags not updating?**
- Check if 24 hours have passed since last fetch
- Manually clear `feature_flags_last_fetched` in personas.json
- Verify PostHog API access

**Users not adapting?**
- Check browser journey logs for flag check results
- Verify flag names match exactly (case-sensitive)
- Ensure personas have flag data populated

**API rate limiting?**
- System fetches in batches of 10 with 500ms delay
- Adjust `flagBatchSize` in synthetic-traffic.js if needed

## Technical Details

### API Integration
Uses PostHog's `/decide` endpoint:
```javascript
POST https://eu.i.posthog.com/decide/?v=3
{
  "api_key": "phc_xxx",
  "distinct_id": "p_00001_xxx",
  "person_properties": { /* persona properties */ }
}
```

Response provides all active feature flags and their variants for that user.

### Performance
- Flag fetching adds ~100-500ms per persona (batched)
- Caches flags for 24 hours
- Minimal impact on session simulation time

### Data Storage
- Flags stored in `.synthetic_state/personas.json`
- Persisted across runs
- Automatically migrated for existing personas
