# Rage Click Simulation - Quick Reference

## 🔥 What's New

Enhanced rage click simulation for the HogFlix demo's Ultimate pricing plan button with realistic human behavior patterns.

## Files Created/Modified

1. **`scripts/generate-rage-clicks.ts`** - NEW
   - Dedicated script for generating rage click sessions
   - No AI required (simpler and cheaper than generate-replays.ts)
   - Generates 5 sessions by default (configurable via `RAGE_CLICK_COUNT`)

2. **`scripts/generate-replays.ts`** - MODIFIED
   - Added `journeyRageClickUltimate()` function with realistic rage click patterns
   - Increased pricing journey probability from 25% to 35%
   - Enhanced with PostHog event tracking

3. **`.github/workflows/synthetic-rage-clicks.yml`** - NEW
   - Dedicated GitHub Action that runs every 2 hours
   - Can be manually triggered via workflow_dispatch

## Features

### Realistic Rage Click Behavior
- **Variable click count**: 5-12 clicks (randomized)
- **Non-uniform timing**: Starts at 200ms, speeds up to 50ms as frustration builds
- **Mouse jitter**: ±10-20px variation between clicks
- **Thinking pause**: 500-1000ms pause after 3rd click
- **PostHog tracking**: Custom events for demo visibility

### PostHog Events Generated
- `rage_click_started` - When rage clicking begins
- `rage_click_attempt` - Each individual click (with click_number property)
- `rage_click_abandoned` - When user gives up

## Usage

### Local Testing (Single Session)
```bash
cd hogflix-project
TARGET_URL='https://hogflix-demo.lovable.app/' \
npx tsx scripts/generate-rage-clicks.ts
```

### Local Testing (Multiple Sessions)
```bash
TARGET_URL='https://hogflix-demo.lovable.app/' \
RAGE_CLICK_COUNT='3' \
npx tsx scripts/generate-rage-clicks.ts
```

### Production (GitHub Actions)
The workflow runs automatically every 2 hours, or you can manually trigger it:
1. Go to GitHub Actions tab
2. Select "Synthetic Rage Clicks (Ultimate Plan)" workflow
3. Click "Run workflow"

## Viewing in PostHog

### Filter Session Replays
```
event = "rage_click_started" OR
properties.$current_url contains "/pricing"
```

### Dashboard Insights
Create insights with these filters:
- **Rage Click Volume**: `event = "rage_click_attempt"` (count)
- **Affected Users**: `event = "rage_click_started"` (unique users)
- **Sessions with Rage Clicks**: Session recordings filtered by `$rageclick` event

## Next Steps (Phase 2)

After rage clicks are generating consistently:
1. **Error Tracking**: Make Ultimate button throw JavaScript error
2. **Error → Replay Link**: Verify PostHog links error to session replay
3. **Demo Dashboard**: Create pre-built dashboard for demo presentations

## Technical Details

### Why No AI for Rage Clicks?
The dedicated `generate-rage-clicks.ts` script doesn't use Gemini AI because:
- Rage clicking is a simple, repetitive action (no decision-making needed)
- Saves API costs
- Faster execution
- More reliable/consistent

### Session Flow
1. Login with rotating user accounts (7 accounts available)
2. Handle profile selection if needed
3. Browse homepage briefly (realistic behavior)
4. Navigate to pricing page
5. Perform rage click with realistic pattern
6. Flush PostHog session recording
7. Repeat for N sessions

### Rate Limiting
- 5-second delay between sessions to avoid overwhelming the app
- Each session uses a different user account (rotates through 7 accounts)

---

**Last Updated**: 2025-11-25  
**Created By**: Onboarding Project - Phase 1 (Rage Click Simulation)
