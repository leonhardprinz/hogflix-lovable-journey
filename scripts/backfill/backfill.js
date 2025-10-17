// scripts/backfill/backfill.js
// Backfill synthetic traffic into the past using server-side /capture.
// - Uses "timestamp" to write historical events (PostHog supports ISO timestamps).
// - Creates stable "personas" (distinct_ids) so retention looks realistic.
// - Marks every event { synthetic: true, is_synthetic: true }.
// - NEVER touches the "PostHog Demo" area or events.
// - Also $set person properties (plan, locale, synthetic) via $set in properties.

import { request as httpsRequest } from 'node:https'

/** --- CONFIG via ENV (all optional except POSTHOG_API_KEY) --- **/
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY // <- set in GitHub Secrets
const START_DATE = process.env.START_DATE || '2025-10-01'   // inclusive, UTC
const END_DATE   = process.env.END_DATE   || '2025-10-16'   // inclusive, UTC
const PERSONAS   = Number(process.env.PERSONAS || 400)      // size of persona pool
const AVG_EVENTS_PER_ACTIVE_DAY = Number(process.env.AVG_EVENTS_PER_ACTIVE_DAY || 6)
const DRY_RUN = String(process.env.DRY_RUN || 'false') === 'true' // if true, don't send

if (!POSTHOG_API_KEY && !DRY_RUN) {
  console.error('Missing POSTHOG_API_KEY (set it in GitHub Secrets). Or set DRY_RUN=true to test.')
  process.exit(1)
}

/** ---------- util ---------- **/
const rand = (n) => Math.floor(Math.random() * n)
const choice = (arr) => arr[rand(arr.length)]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isoAt(dateObj, h, m, s) {
  const d = new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    h, m, s, rand(900)
  ))
  return d.toISOString()
}

function* daysInclusive(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield new Date(d)
  }
}

function capture(event, properties, distinct_id, timestampIso) {
  const payload = JSON.stringify({
    api_key: POSTHOG_API_KEY,
    event,
    properties: {
      ...properties,
      synthetic: true,
      is_synthetic: true,
      $lib: 'server',
    },
    distinct_id,
    timestamp: timestampIso, // historical write
  })

  if (DRY_RUN) {
    console.log('[DRY_RUN] would send', { event, distinct_id, timestamp: timestampIso, properties })
    return Promise.resolve()
  }

  const url = new URL('/capture/', POSTHOG_HOST)
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        res.on('data', () => {})
        res.on('end', resolve)
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

/** ---------- persona + schedule model ---------- **/
// stable personas: bf-1 … bf-N with sticky plan & locale
function personaOf(i) {
  const plan = i % 3 === 0 ? 'Premium' : 'Standard'
  const locale = i % 2 === 0 ? 'de-DE' : 'sl-SI'
  const device = i % 4 === 0 ? 'mobile' : 'desktop'
  return { id: `bf-${i}`, plan, locale, device }
}

// probability an existing persona is active on a day (creates imperfect retention)
function activeTodayProb(dayIndex) {
  // day 0 high, then decays a bit; add weekly bump
  const base = 0.35 * Math.exp(-dayIndex / 14) + 0.10 * (dayIndex % 7 === 0 ? 1 : 0)
  return Math.max(0.08, Math.min(0.55, base))
}

// generate a handful of events that look like "non-demo" browsing
async function emitDayForPersona(date, p) {
  const dayIndex = Math.round((date - new Date(`${START_DATE}T00:00:00Z`)) / 86400000)
  if (Math.random() > activeTodayProb(dayIndex)) return

  const distinct_id = p.id
  const utm_source   = choice(['organic', 'referral', 'newsletter', 'partner'])
  const utm_medium   = choice(['web', 'social', 'email'])
  const utm_campaign = choice(['weekly', 'promo', 'fall'])
  const section      = choice(['popular', 'trending', 'new'])
  const genre        = choice(['sci-fi', 'drama', 'family', 'comedy'])

  // set person properties via $set once per day (idempotent)
  const ts0 = isoAt(date, 9 + rand(10), rand(60), rand(50))
  await capture('$pageview',
    {
      $current_url: 'https://hogflix-demo.lovable.app/',
      utm_source, utm_medium, utm_campaign,
      $set: { plan: p.plan, locale: p.locale, device: p.device, synthetic: true, is_synthetic: true },
    },
    distinct_id,
    ts0
  )

  // catalog browse
  const ts1 = isoAt(date, 10 + rand(10), rand(60), rand(50))
  await capture('browse_catalog',
    { section, utm_source, utm_medium, utm_campaign },
    distinct_id,
    ts1
  )

  // user opens a non-demo title
  const ts2 = isoAt(date, 11 + rand(10), rand(60), rand(50))
  const titleId = `t-${genre}-${rand(5000)}`
  const title   = `${genre.toUpperCase()} #${rand(999)}`
  await capture('title_opened',
    { title_id: titleId, title, genre, plan: p.plan },
    distinct_id,
    ts2
  )

  // small chance they "watch" a generic (non-demo) video
  if (Math.random() < 0.65) {
    const tsPlay = isoAt(date, 12 + rand(10), rand(60), rand(50))
    await capture('video_play',
      { title_id: titleId, title, genre, context: 'catalog' },
      distinct_id,
      tsPlay
    )

    // a few progress pings (NOT demo_* names; avoids your demo analytics)
    const steps = [10, 30, 60, 90].filter(() => Math.random() < 0.7)
    for (const pct of steps) {
      const tsProg = isoAt(date, 12 + rand(10), rand(60), rand(50))
      await capture('video_progress',
        { title_id: titleId, title, progress_pct: pct, context: 'catalog' },
        distinct_id,
        tsProg
      )
      await sleep(20) // gentle pacing
    }

    if (Math.random() < 0.35) {
      const tsEnd = isoAt(date, 13 + rand(10), rand(60), rand(50))
      await capture('video_complete',
        { title_id: titleId, title, context: 'catalog' },
        distinct_id,
        tsEnd
      )
    }
  }

  // occasional search
  if (Math.random() < 0.3) {
    const tsS = isoAt(date, 14 + rand(6), rand(60), rand(50))
    await capture('search',
      { q: choice(['hog', 'space', 'family', 'robot']), results: 10 + rand(30) },
      distinct_id,
      tsS
    )
  }

  // optional “return later same day”
  if (Math.random() < 0.15) {
    const tsLate = isoAt(date, 20 + rand(3), rand(60), rand(50))
    await capture('$pageview',
      { $current_url: 'https://hogflix-demo.lovable.app/profile', utm_source },
      distinct_id,
      tsLate
    )
  }
}

async function main() {
  console.log(`Backfill range: ${START_DATE} → ${END_DATE} | personas: ${PERSONAS} | avg/day ~${AVG_EVENTS_PER_ACTIVE_DAY} | DRY_RUN=${DRY_RUN}`)

  let i = 0
  for (const day of daysInclusive(START_DATE, END_DATE)) {
    console.log(`\n🗓  ${day.toISOString().slice(0,10)}  — generating...`)
    // sample ~40% of personas per day to keep volume sane
    const todaysPool = Math.max(1, Math.round(PERSONAS * 0.4))
    for (let k = 0; k < todaysPool; k++) {
      const idx = 1 + rand(PERSONAS)
      const p = personaOf(idx)
      await emitDayForPersona(day, p)
      if (++i % 200 === 0) await sleep(100) // back off every 200 sends
    }
  }

  console.log('\n✅ Backfill complete.')
}

main().catch((e) => {
  console.error('Backfill error:', e)
  process.exit(1)
})
