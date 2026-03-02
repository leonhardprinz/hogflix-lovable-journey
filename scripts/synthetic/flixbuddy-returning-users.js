// FlixBuddy Returning Users — runs every CI cycle
// Loads personas from flixbuddy_cohort.json (built by experiment funnel + backfill)
// Replays each persona with age-based decay so the retention chart fills in naturally
//
// Return probabilities (independent per week):
//   week 1: 35%  week 2: 22%  week 3: 14%  week 4: 9%  week 5: 5%  week 6+: 3%

import { PostHog } from 'posthog-node'
import fs from 'node:fs'
import path from 'node:path'

const PH_PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY || process.env.POSTHOG_KEY
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const DRY_RUN = process.env.DRY_RUN === 'true'

if (!PH_PROJECT_API_KEY) {
  console.error('Error: PH_PROJECT_API_KEY or POSTHOG_KEY env var is required')
  process.exit(1)
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

const COHORT_FILE = path.join(STATE_DIR, 'flixbuddy_cohort.json')

// Return probability by age in weeks (independent — not cumulative)
const RETURN_PROB = [
  null,  // week 0 — first event handled by funnel itself
  0.35,  // week 1
  0.22,  // week 2
  0.14,  // week 3
  0.09,  // week 4
  0.05,  // week 5
  0.03,  // week 6+
]

function getWeekAge(createdAt) {
  const created = new Date(createdAt)
  const now = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor((now - created) / msPerWeek)
}

function returnProbForAge(ageWeeks) {
  if (ageWeeks <= 0) return 0
  return RETURN_PROB[Math.min(ageWeeks, RETURN_PROB.length - 1)]
}

;(async () => {
  if (!fs.existsSync(COHORT_FILE)) {
    console.log('No flixbuddy_cohort.json found — nothing to replay. Run backfill-retention.js first.')
    process.exit(0)
  }

  const personas = JSON.parse(fs.readFileSync(COHORT_FILE, 'utf8'))
  console.log(`\nFlixBuddy returning users (${personas.length} personas in pool)`)
  console.log(`  Dry run: ${DRY_RUN}\n`)

  let sent = 0, skipped = 0

  for (const persona of personas) {
    const age = getWeekAge(persona.createdAt)
    const prob = returnProbForAge(age)

    if (Math.random() > prob) {
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would send return event for ${persona.id} (age ${age}w, prob ${(prob * 100).toFixed(0)}%)`)
      sent++
      continue
    }

    const props = {
      experiment_variant: persona.variant,
      is_synthetic: true,
      synthetic_source: 'flixbuddy-returning-users',
      returning_week: age,
    }

    posthog.capture({ distinctId: persona.id, event: 'flixbuddy:opened',       properties: props })
    posthog.capture({ distinctId: persona.id, event: 'flixbuddy:message_sent', properties: { ...props, message_text: 'What should I watch tonight?' } })

    sent++

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 30 + Math.random() * 70))
  }

  console.log(`\nDone: ${sent} return events sent, ${skipped} personas skipped this cycle`)

  if (!DRY_RUN) await posthog.shutdown()
})()
