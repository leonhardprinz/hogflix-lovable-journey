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

function loadPersonas() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    throw new Error('Missing personas.json. Run scripts/synthetic-traffic.js once to create it.')
  }
  const all = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
  return all.slice(0, POOL)
}

function* eachDay(start, end) {
  const d = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (d <= last) {
    yield new Date(d)
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

async function main() {
  const personas = loadPersonas()

  for (const day of eachDay(START_DATE, END_DATE)) {
    const iso = day.toISOString()
    console.log('Backfilling day', iso.slice(0, 10))

    // Ensure plan is set on the person
    for (const p of personas) {
      await posthog.identify({
        distinctId: p.distinct_id,
        properties: { plan: p.plan, is_synthetic: true },
      })
    }

    // Events on that day
    for (const p of personas) {
      await posthog.capture({
        distinctId: p.distinct_id,
        event: 'title_opened',
        properties: { plan: p.plan, is_synthetic: true },
        timestamp: iso,
      })

      const r = Math.random()
      if (r < 0.2) {
        await posthog.capture({
          distinctId: p.distinct_id,
          event: 'video:progress_milestone',
          properties: {
            milestone: 75,
            video_id: '6f4d68aa-3d28-43eb-a16d-31848741832b',
            plan: p.plan,
            is_synthetic: true,
          },
          timestamp: iso,
        })
      }
      if (r < 0.1) {
        await posthog.capture({
          distinctId: p.distinct_id,
          event: 'video:completed',
          properties: {
            video_id: '6f4d68aa-3d28-43eb-a16d-31848741832b',
            plan: p.plan,
            is_synthetic: true,
          },
          timestamp: iso,
        })
      }
    }
  }

  await posthog.flushAsync()
  console.log('Backfill complete')
}

main().catch(async (e) => {
  console.error(e)
  await posthog.shutdownAsync()
  process.exit(1)
})
