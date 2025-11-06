// Node >= 18, ESM
import { PostHog } from 'posthog-node'
import fs from 'node:fs'
import path from 'node:path'

const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const PH_PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY
if (!PH_PROJECT_API_KEY) {
  console.error('Missing PH_PROJECT_API_KEY')
  process.exit(1)
}

const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

const START_DATE = process.env.START_DATE // YYYY-MM-DD
const END_DATE = process.env.END_DATE     // YYYY-MM-DD
const POOL = Number(process.env.PERSONA_POOL || 400)

if (!START_DATE || !END_DATE) {
  console.error('Provide START_DATE and END_DATE (YYYY-MM-DD)')
  process.exit(1)
}

const VIDEO_ID = '6f4d68aa-3d28-43eb-a16d-31848741832b'

function* eachDay(start, end) {
  const d = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (d <= last) {
    yield new Date(d)
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

function loadPersonas() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    throw new Error('Missing personas.json. Run scripts/synthetic-traffic.js once to create it.')
  }
  const all = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
  // enrich missing source if needed
  all.forEach((p, i) => {
    if (!p.source) {
      const r = i % 100
      p.source = r < 40 ? 'direct' : r < 70 ? 'newsletter' : r < 95 ? 'linkedin' : r < 97 ? 'organic' : r < 99 ? 'partner' : 'referral'
    }
    if (p.return_prob == null) p.return_prob = 0.3
  })
  return all.slice(0, POOL)
}

function baseProps(p) {
  return {
    plan: p.plan ?? p['plan'],
    company_plan: p.company_plan ?? p['company_plan'] ?? (p.plan ?? p['plan']),
    is_synthetic: true,
    source: p.source,
    $utm_source: p.source,
    $utm_medium: 'synthetic',
    $utm_campaign: 'hogflix-bot',
  }
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

async function main() {
  const personas = loadPersonas()

  for (const day of eachDay(START_DATE, END_DATE)) {
    const ts = day.toISOString()
    const dayOfWeek = day.getUTCDay()
    const factor = [0.85, 0.9, 0.95, 1.0, 1.1, 1.15, 1.05][dayOfWeek]

    // ensure person props exist
    for (const p of personas) {
      await posthog.identify({
        distinctId: p.distinct_id,
        properties: {
          plan: p.plan ?? p['plan'],
          company_plan: p.company_plan ?? p['company_plan'] ?? (p.plan ?? p['plan']),
          acq_source: p.source,
          is_synthetic: true,
          $initial_utm_source: p.source,
          $initial_utm_medium: 'synthetic',
          $initial_utm_campaign: 'hogflix-bot',
        },
      })
    }

    for (const p of personas) {
      const active = Math.random() < Math.min(Math.max(p.return_prob * factor, 0.02), 0.95)
      if (!active) continue

      // section:clicked
      await posthog.capture({
        distinctId: p.distinct_id,
        event: 'section:clicked',
        properties: { ...baseProps(p), section: 'Popular' },
        timestamp: ts,
      })

      // video:title_opened
      await posthog.capture({
        distinctId: p.distinct_id,
        event: 'video:title_opened',
        properties: { ...baseProps(p), title_id: VIDEO_ID },
        timestamp: ts,
      })

      // video:started (60%) and progress >=50 (55% of starters)
      if (Math.random() < 0.6) {
        await posthog.capture({
          distinctId: p.distinct_id,
          event: 'video:started',
          properties: { ...baseProps(p), video_id: VIDEO_ID },
          timestamp: ts,
        })
        if (Math.random() < 0.55) {
          await posthog.capture({
            distinctId: p.distinct_id,
            event: 'video:progress',
            properties: { ...baseProps(p), video_id: VIDEO_ID, milestone: 50 },
            timestamp: ts,
          })
        }
      }

      // rare pricing:plan_selected
      if (Math.random() < 0.01) {
        await posthog.capture({
          distinctId: p.distinct_id,
          event: 'pricing:plan_selected',
          properties: { ...baseProps(p), selected_plan: p.plan ?? p['plan'] },
          timestamp: ts,
        })
      }
    }
  }

  await posthog.flush()
  await posthog.shutdown()
  console.log('Backfill complete')
}

main().catch(async (e) => {
  console.error(e)
  try { await posthog.shutdown() } catch {}
  process.exit(1)
})
