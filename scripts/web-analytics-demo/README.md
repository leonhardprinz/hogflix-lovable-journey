# Web Analytics demo seeders

Two scripts that top up project `85924` (EU, `eu.posthog.com`) with the data the PostHog Web Analytics dashboard needs to look believable on a live demo: UTM-tagged traffic across multiple channels, multi-country geographic spread, and two conversion-eligible events.

Both are **server-side** (Node + `posthog-node`) - no real browser involved. Originally the UTM seeder used Playwright, but the deployed SPA + PostHog autocapture-force-start + headless detection + sendBeacon timing made browser-driven seeding flaky (1 in 5 sessions actually arrived in PostHog). The server-side path gives 100% delivery for the demo-critical data (channels, UTMs, paths, geo, conversions).

> What you DON'T get from these scripts: `$web_vitals`, `$autocapture` click events, and session replays for the synthetic sessions specifically. That's fine - your **real users** + the **existing `scripts/playwright-journey-*.js` scripts** already provide those, and they're unchanged by this work.

These run independently of the existing synthetic-traffic system. They do not touch `.synthetic_state/`, do not modify any existing files, and tag every event they emit with `synthetic_source: 'web-analytics-demo'` or `'web-analytics-demo-geo'` so they can be filtered out or audited later.

---

## TL;DR

```
# In two separate terminals, leave them running until / through the demo:
npm run seed:wa:utm:loop
npm run seed:wa:geo:loop

# Or one-shot for a quick top-up:
npm run seed:wa:utm -- --count 200
npm run seed:wa:geo -- --count 200
```

Open the dashboard at https://eu.posthog.com/project/85924/web after ~30 minutes to see the tiles populate.

---

## What each script does

### `seed-utm-traffic.js` - UTM + channel + conversion events

Emits `$pageview` events via `posthog-node` with rich attribution metadata and fires conversion events on a fraction of sessions.

- **8 traffic channels** weighted to look like a real marketing site:
  - Direct (22%)
  - Google CPC with `gclid` (20%) - Paid Search
  - Facebook Paid Social with `fbclid` (12%) - Paid Social
  - Newsletter Email (12%) - Email
  - Organic Search (11%) - Organic Search (Google referrer, organic medium)
  - Twitter Organic Social (8%) - Organic Social
  - HackerNews Referral (8%) - Referral
  - Reddit Referral (7%) - Referral
- **10 countries weighted toward US / UK / DE / FR** plus NL, CA, AU, ES, BR, IT. Smaller spread than the geo seeder; this script's focus is channel attribution, not geography.
- **6 device profiles**: Chrome / Safari / Firefox across macOS / Windows / iOS / Android, with realistic `$browser_version`, `$screen_*`, `$viewport_*` properties set explicitly.
- **30% identified sessions** with a synthetic email (`emma.nielsen1234@gmail.com` style), 70% anonymous.
- **40% of sessions emit a second pageview** so the Bounce Rate metric sits in a believable range (~60%) instead of pinned to 100%.
- **Two conversion events fired** (so you can pick either as the conversion goal in the dashboard):
  - `signup_completed` - fired on ~8% of sessions with `method`, `email_provided`, `plan_selected` properties. Synthesized to fire from `/signup`.
  - `subscription_started` - fired on ~6% of sessions with `plan` (basic/standard/premium), `price_usd`, `billing_period`. Synthesized to fire from `/checkout`.
- All events use `disableGeoip: true` so PostHog's GeoIP transformation doesn't overwrite the manual `$geoip_*` properties with the source IP (your machine).
- All events tagged `synthetic_source: 'web-analytics-demo'` and `demo_seeder_version: 2`.

### `seed-geo-spread.js` - geographic spread

Same architecture but optimized for World Map coverage rather than channel variety.

- **15 countries weighted by typical SaaS distribution** (US 22%, GB / DE 11% each, FR 8%, NL 7%, ES / IT / CA / BR / AU / JP / MX / SE / PL / IN at 3-6%).
- Each country has 2-5 candidate cities + a timezone for internal variety.
- Same channel mix as the UTM seeder so the Channels tile stays consistent.
- Same device mix.
- All events tagged `synthetic_source: 'web-analytics-demo-geo'`.

### Why both?

The UTM seeder concentrates traffic in markets where the channels are most active (US 35%, EU heavy). The geo seeder spreads broader (15 countries including AP / LATAM) for World Map coverage. Run both for the fullest picture.

| Tile | UTM seeder | Geo seeder |
|:-----|:-----------|:-----------|
| Visitors / Sessions / Pageviews | ✅ | ✅ |
| Channels | ✅ | ✅ |
| UTM source / medium / campaign | ✅ | ✅ |
| Top Paths | ✅ | ✅ |
| World Map | ✅ (10 countries) | ✅ (15 countries) |
| Bounce Rate (in believable range) | ✅ | ⚠️ (always single-page) |
| Conversion goal events | ✅ | ❌ |
| Web Vitals | ❌ | ❌ |
| Session Replay | ❌ | ❌ |
| Autocapture | ❌ | ❌ |

For Web Vitals, Session Replay, and Autocapture: rely on real users + the existing `scripts/playwright-journey-*.js` scripts (unchanged by this work).

---

## CLI flags (same on both scripts)

| Flag | Default | What it does |
|:-----|:--------|:-------------|
| `--count N` | `20` (utm) / `50` (geo) | One-shot: emit N sessions/events then exit |
| `--loop` | off | Continuous mode - runs until you Ctrl-C |
| `--rate N` | `60`/hr (utm) / `40`/hr (geo) | Sessions/events per hour in loop mode |

Both scripts respond cleanly to SIGINT / SIGTERM.

### Env vars

| Var | Used by | Default |
|:----|:--------|:--------|
| `POSTHOG_KEY` | both | `phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh` (project 85924) |
| `POSTHOG_HOST` | both | `https://eu.i.posthog.com` |
| `APP_HOST` | both | `hogflix-project.vercel.app` (used as synthetic `$host`) |
| `DEBUG` | both | `false` - set `true` for per-session/per-event logging |

### Examples

```bash
# Quick burst before a demo
npm run seed:wa:utm -- --count 200
npm run seed:wa:geo -- --count 300

# Run continuously at a calmer cadence (30/hr instead of default 60/hr)
npm run seed:wa:utm:loop -- --rate 30

# Watch what's happening per-session
DEBUG=true npm run seed:wa:utm -- --count 20
```

---

## Pre-demo verification checklist

After running both loops for at least 30 minutes, check https://eu.posthog.com/project/85924/web. You should see:

- [ ] **Visitors > 50, Sessions > 50 in the last 7 days** (top tiles populated)
- [ ] **Channels tile** shows at least 5 of: Direct, Paid Search, Paid Social, Email, Organic Search, Organic Social, Referral
- [ ] **UTM source table** shows `google`, `facebook`, `newsletter`, `twitter` at minimum
- [ ] **UTM campaign table** shows `spring_sale_2026`, `lookalike_audience_q2`, `weekly_digest`, `launch_thread`
- [ ] **World Map** shows 10+ countries with traffic (not just US + SI)
- [ ] **Top Paths** shows 6+ paths
- [ ] **Bounce rate** is between 30-80% (the UTM seeder's 40% multi-page sessions push it down from 100%)
- [ ] **Web Vitals tile** shows actual LCP / INP / CLS / FCP values *(comes from real users, not these scripts)*
- [ ] **Conversion goal** can be set on `signup_completed` OR `subscription_started` and shows non-zero count

### Manual steps (you do these in the UI)

These are not automated by the scripts - do them once before the demo:

1. **Enable GeoIP transformation** at https://eu.posthog.com/project/85924/data-pipelines if not already on. *(The seeders use `disableGeoip: true` for their own events, but real users need it for accurate location.)*
2. **Verify Web Vitals** is enabled at Settings → Web Vitals. (Currently confirmed firing in the project - 830 `$web_vitals` events in the last 7 days.)
3. **Set the conversion goal** at https://eu.posthog.com/project/85924/web → "Add conversion goal" → pick `signup_completed` (top-of-funnel feel) OR `subscription_started` (revenue feel). Both events fire from the seeder. You can switch live during the demo if you want.
4. **Add path cleaning rules** at Settings → Path cleaning if you want the Paths tile to crisp up (e.g., `/movies/[id] → /movies/:id`).

---

## Conversion event options

Switch between these in the dashboard at demo time:

| Event | Fires from | Properties | Demo angle |
|:------|:-----------|:-----------|:-----------|
| `signup_completed` | UTM seeder (8% of sessions) | `method`, `email_provided`, `plan_selected`, plus full UTM/channel/device/geo attribution from the parent session | Top-of-funnel CTA conversion (marketer's KPI) |
| `subscription_started` | UTM seeder (6% of sessions) | `plan` (basic/standard/premium), `price_usd`, `billing_period`, plus full attribution | Revenue conversion (PM / RevOps KPI) |

Both share `$session_id` and `distinct_id` with their parent landing pageview, so they correctly attribute through the Channels and UTM tables.

---

## How to "reset" the demo

PostHog has no bulk-delete for events - the demo data accumulates over time. Two options:

- **Stop the seeders and wait.** Default `last 7 days` view will roll forward and the relative weight of demo data drops over time.
- **Filter it out.** All seeded events carry `synthetic_source IN ('web-analytics-demo', 'web-analytics-demo-geo')` and `demo_seeder_version` (1 or 2). You can build a project-wide insight filter / cohort to exclude them if you want a "real" view. (Not recommended for the demo itself - we WANT this data to show up.)

---

## What this does NOT touch

For confidence the existing demo isn't at risk:

- `src/main.tsx` PostHog init - **unchanged**
- `.synthetic_state/` - **unchanged**
- `scripts/synthetic-traffic.js` and other existing scripts - **unchanged**
- `scripts/marketing/`, `scripts/synthetic/`, `scripts/backfill/`, `scripts/migration/` - **unchanged**
- All existing npm scripts in `package.json` - **unchanged** (only new `seed:wa:*` scripts added)
- Any existing event taxonomy - the new scripts emit `$pageview` (already used) and two new events `signup_completed` / `subscription_started` that don't conflict with anything

---

## Project context

- **PostHog project:** 85924 (EU, `https://eu.posthog.com`)
- **PostHog API host:** `https://eu.i.posthog.com`
- **App project key:** `phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh`
- **Built for:** the TBC Bank Web Analytics call on 2026-06-02 (and any future ad-hoc WA demos)
