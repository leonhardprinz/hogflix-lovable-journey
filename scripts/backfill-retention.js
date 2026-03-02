// One-time backfill: seeds 7 weeks of FlixBuddy retention cohorts
// Creates synthetic personas with realistic first + return event distribution
// Idempotent — tracks completed weeks in STATE_DIR/backfill_retention_done.json
//
// Run: PH_PROJECT_API_KEY=<key> node scripts/backfill-retention.js

import { PostHog } from 'posthog-node'
import fs from 'node:fs'
import path from 'node:path'

const PH_PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY || process.env.POSTHOG_KEY
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const COHORT_SIZE = parseInt(process.env.COHORT_SIZE || '60', 10)
const DRY_RUN = process.env.DRY_RUN === 'true'

if (!PH_PROJECT_API_KEY) {
  console.error('Error: PH_PROJECT_API_KEY or POSTHOG_KEY env var is required')
  process.exit(1)
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

// The 7 cohort weeks to backfill (Monday start dates)
const COHORT_WEEKS = [
  '2026-01-12',
  '2026-01-19',
  '2026-01-26',
  '2026-02-02',
  '2026-02-09',
  '2026-02-16',
  '2026-02-23',
]

// Return probability by weeks-since-first-event (independent per week, not cumulative)
// e.g. 35% of cohort comes back in week+1, 22% in week+2, etc.
const RETURN_PROB = [
  1.00,  // week 0 — always (first event)
  0.35,  // week 1
  0.22,  // week 2
  0.14,  // week 3
  0.09,  // week 4
  0.05,  // week 5
  0.03,  // week 6
]

const VARIANTS = ['control', 'suggested-prompts', 'personalized']
const DEVICES = [
  { type: 'Desktop', browser: 'Chrome', os: 'Windows', weight: 45 },
  { type: 'Desktop', browser: 'Safari', os: 'macOS', weight: 25 },
  { type: 'Mobile', browser: 'Safari', os: 'iOS', weight: 20 },
  { type: 'Mobile', browser: 'Chrome', os: 'Android', weight: 10 },
]

function weightedDevice() {
  const total = DEVICES.reduce((s, d) => s + d.weight, 0)
  let r = Math.random() * total
  for (const d of DEVICES) { r -= d.weight; if (r <= 0) return d }
  return DEVICES[0]
}

// Deterministic distinct_id so re-runs produce the same IDs (no duplicates)
function personaId(cohortWeek, index) {
  return `flixbuddy-backfill-${cohortWeek}-${String(index).padStart(3, '0')}`
}

// Random timestamp within a Mon–Sun week, weighted toward evenings
function randomTimestampInWeek(weekStartStr, dayOffset = 0) {
  const base = new Date(weekStartStr + 'T00:00:00Z')
  const day = Math.floor(Math.random() * 7) // 0–6
  // Hour distribution: weighted toward evenings (18–23)
  const hourWeights = [0,0,0,0,0,0,0,0, 1,1,1,2,2,3,3,3,4,5,7,8,8,8,7,5]
  const total = hourWeights.reduce((s, w) => s + w, 0)
  let hr = Math.random() * total
  let hour = 0
  for (let i = 0; i < hourWeights.length; i++) { hr -= hourWeights[i]; if (hr <= 0) { hour = i; break } }
  const minute = Math.floor(Math.random() * 60)
  const second = Math.floor(Math.random() * 60)
  const ts = new Date(base)
  ts.setUTCDate(ts.getUTCDate() + day + dayOffset * 7)
  ts.setUTCHours(hour, minute, second, 0)
  return ts
}

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

function sendFlixBuddySession(distinctId, variant, device, timestamp) {
  const commonProps = {
    experiment_variant: variant,
    $device_type: device.type,
    $browser: device.browser,
    $os: device.os,
    is_synthetic: true,
    synthetic_source: 'flixbuddy-backfill',
  }
  const ts = new Date(timestamp)

  posthog.capture({ distinctId, event: 'flixbuddy:opened',        timestamp: ts, properties: { ...commonProps } })
  posthog.capture({ distinctId, event: 'flixbuddy:message_sent',  timestamp: ts, properties: { ...commonProps, message_text: 'What should I watch tonight?' } })
}

// State tracking for idempotency
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })
const DONE_FILE = path.join(STATE_DIR, 'backfill_retention_done.json')
const COHORT_FILE = path.join(STATE_DIR, 'flixbuddy_cohort.json')

const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE, 'utf8')) : {}
const existingCohort = fs.existsSync(COHORT_FILE) ? JSON.parse(fs.readFileSync(COHORT_FILE, 'utf8')) : []

const today = new Date()

;(async () => {
  console.log(`\nFlixBuddy retention backfill`)
  console.log(`  Cohort size: ${COHORT_SIZE} users/week`)
  console.log(`  Dry run: ${DRY_RUN}\n`)

  const newPersonas = []
  let totalFirst = 0, totalReturn = 0, totalSkipped = 0

  for (const weekStart of COHORT_WEEKS) {
    if (done[weekStart]) {
      console.log(`  ⏭  Week ${weekStart} — already backfilled, skipping`)
      totalSkipped++
      continue
    }

    console.log(`\n  📅 Cohort week ${weekStart} (${COHORT_SIZE} personas)`)

    const weekPersonas = []

    for (let i = 0; i < COHORT_SIZE; i++) {
      const id = personaId(weekStart, i)
      const variant = VARIANTS[i % VARIANTS.length]
      const device = weightedDevice()

      // Week 0 — first event
      const firstTs = randomTimestampInWeek(weekStart)
      if (!DRY_RUN) sendFlixBuddySession(id, variant, device, firstTs)
      totalFirst++

      const persona = { id, variant, device, cohortWeek: weekStart, createdAt: firstTs.toISOString() }

      // Return events for subsequent weeks
      for (let weekOffset = 1; weekOffset < RETURN_PROB.length; weekOffset++) {
        const returnWeekStart = addWeeks(weekStart, weekOffset)
        // Don't send events in the future
        if (new Date(returnWeekStart) > today) break

        if (Math.random() < RETURN_PROB[weekOffset]) {
          const returnTs = randomTimestampInWeek(returnWeekStart)
          if (!DRY_RUN) sendFlixBuddySession(id, variant, device, returnTs)
          totalReturn++
        }
      }

      weekPersonas.push(persona)
    }

    newPersonas.push(...weekPersonas)

    if (!DRY_RUN) {
      done[weekStart] = true
      console.log(`  ✓  Week ${weekStart} — ${weekPersonas.length} personas seeded`)
    } else {
      console.log(`  [DRY RUN] Would seed ${weekPersonas.length} personas for ${weekStart}`)
    }
  }

  if (!DRY_RUN) {
    // Persist done state
    fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2))

    // Merge into flixbuddy_cohort.json so returning-users script can use them
    const existingIds = new Set(existingCohort.map(p => p.id))
    const merged = [...existingCohort, ...newPersonas.filter(p => !existingIds.has(p.id))]
    fs.writeFileSync(COHORT_FILE, JSON.stringify(merged, null, 2))
    console.log(`\n  💾 Saved ${newPersonas.length} new personas to ${COHORT_FILE}`)

    await posthog.shutdown()
  }

  console.log(`\nDone:`)
  console.log(`  First events:   ${totalFirst}`)
  console.log(`  Return events:  ${totalReturn}`)
  console.log(`  Weeks skipped:  ${totalSkipped}`)
})()
