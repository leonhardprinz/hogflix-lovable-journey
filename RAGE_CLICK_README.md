# Rage Click Simulation - Quick Reference

## 🔥 What's New

Enhanced rage click simulation for the HogFlix demo's Ultimate pricing plan button with realistic human behavior patterns, **integrated into the existing session replay workflow**.

## How It Works

The rage click logic is built into the existing `generate-replays.ts` script which runs via the **"Synthetic Session Replays"** GitHub Action (every 6 hours).

- **35% of sessions** will visit the pricing page and rage click the Ultimate button
- **Realistic patterns**: Variable click count (5-12), non-uniform timing (50-200ms), mouse jitter
- **PostHog tracking**: Custom events + automatic session replay capture
- **Enhanced visibility**: Automatically scrolls to Ultimate button and uses slow mouse movements for better tracking

## Files Modified

1. **`scripts/generate-replays.ts`** ✅
   - Added `journeyRageClickUltimate()` function with realistic rage click patterns
   - Increased pricing journey probability from 25% to 35%
   - Enhanced with PostHog event tracking (`rage_click_started`, `rage_click_attempt`, `rage_click_abandoned`)
   - Improved video playback reliability and mouse movement realism

## Usage

### Automatic (Production) - RECOMMENDED ✅

The existing **"Synthetic Session Replays"** workflow already includes rage click logic:
- Runs every 6 hours automatically
- Generates full session replays (viewable in PostHog)
- 35% probability of pricing journey with rage clicks

**To manually trigger:**
1. Go to GitHub Actions tab
2. Select "Synthetic Session Replays" workflow  
3. Click "Run workflow"

### Manual Local Testing (Optional)

To test the full replay flow locally:
```bash
cd hogflix-project
TARGET_URL='https://hogflix-demo.lovable.app/' \
GEMINI_API_KEY='your-key' \
npx tsx scripts/generate-replays.ts
```

## Features

### Realistic Rage Click Behavior
- **Variable click count**: 5-12 clicks (randomized)
- **Non-uniform timing**: Starts at 200ms, speeds up to 50ms as frustration builds
- **Mouse jitter**: ±10-20px variation between clicks for natural movement
- **Thinking pause**: 500-1000ms pause after 3rd click (user confusion)
- **PostHog tracking**: Custom events for demo visibility

### PostHog Events Generated
- `rage_click_started` - When rage clicking begins
- `rage_click_attempt` - Each individual click (includes `click_number` property)
- `rage_click_abandoned` - When user gives up (includes `total_clicks`)

All events include `is_synthetic: true` and `button: 'ultimate_plan'` properties.

## Viewing in PostHog

### Filter Session Replays
```
event = "rage_click_started" OR
properties.$current_url contains "/pricing"
```

### Dashboard Insights (Recommended)
Create a dashboard called "Session Replays - Rage Clicks" with:

1. **Rage Click Volume**
   - Event: `rage_click_attempt`
   - Chart: Time series (count)

2. **Affected Users**  
   - Event: `rage_click_started`
   - Chart: Unique users

3. **Session Recordings**
   - Filter: Sessions containing `$rageclick` event or `rage_click_started`
   - Shows actual video replays

## Expected Results

After the workflow runs a few times (12-24 hours), you should see:
- **5-10 rage click sessions per day** (35% of ~15-20 daily sessions)
- **Realistic clicking patterns** in session replays (not robotic)
- **PostHog's automatic rage click detection** flagging these sessions
- **Clear narrative** for demo: "Users are frustrated with Ultimate button"

---

**Last Updated**: 2025-11-25  
**Created By**: HogFlix Onboarding Project - Phase 1 (Rage Click Simulation)  
**Integration**: Built into existing session replay workflow ✅
