// Node >= 18, ESM (your repo uses "type":"module")
import { PostHog } from 'posthog-node'
import fs from 'node:fs'
import path from 'node:path'

// ---------- CONFIG ----------
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const PH_PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY
if (!PH_PROJECT_API_KEY) {
  console.error('Missing PH_PROJECT_API_KEY')
  process.exit(1)
}

const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

// Use the exact property your cohorts use in PostHog
const PLAN_PROP = 'plan'
const PLAN_BUCKETS = ['Standard', 'Premium', 'Basic']
const DEFAULT_POOL_SIZE = Number(process.env.PERSONA_POOL || 400)

// ---------- UTIL ----------
const ensureDir = (p) => fs.existsSync(p) || fs.mkdirSync(p, { recursive: true })

function loadPersonas() {
  ensureDir(STATE_DIR)
  if (fs.existsSync(PERSONAS_FILE)) {
    return JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
  }
  const personas = []
  for (let i = 0; i < DEFAULT_POOL_SIZE; i++) {
    const distinct_id = `p_${String(i).padStart(5, '0')}`
    const plan = PLAN_BUCKETS[i % PLAN_BUCKETS.length]
    personas.push({ distinct_id, plan })
  }
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(personas, null, 2))
  return personas
}

function savePersonas(personas) {
  ensureDir(STATE_DIR)
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(personas, null, 2))
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

async function identifyPerson(person) {
  await posthog.identify({
    distinctId: person.distinct_id,
    properties: { [PLAN_PROP]: person.plan, is_synthetic: true },
  })
}

async function emitDay(person) {
  // Retention driver
  await posthog.capture({
    distinctId: person.distinct_id,
    event: 'title_opened',
    properties: { [PLAN_PROP]: person.plan, is_synthetic: true },
  })

  // Feed your demo fallback actions
  const r = Math.random()
  if (r < 0.35) {
    await posthog.capture({
      distinctId: person.distinct_id,
      event: 'video:progress_milestone',
      properties: {
        milestone: 75,
        video_id: '6f4d68aa-3d28-43eb-a16d-31848741832b',
        [PLAN_PROP]: person.plan,
        is_synthetic: true,
      },
    })
  }
  if (r < 0.15) {
    await posthog.capture({
      distinctId: person.distinct_id,
      event: 'video:completed',
      properties: {
        video_id: '6f4d68aa-3d28-43eb-a16d-31848741832b',
        [PLAN_PROP]: person.plan,
        is_synthetic: true,
      },
    })
  }
}

async function main() {
  const personas = loadPersonas()
  await Promise.all(personas.map(identifyPerson))
  for (const p of personas) await emitDay(p)
  await posthog.flushAsync()
  savePersonas(personas)
  console.log(`Emitted events for ${personas.length} personas`)
}

main().catch(async (e) => {
  console.error(e)
  await posthog.shutdownAsync()
  process.exit(1)
})
