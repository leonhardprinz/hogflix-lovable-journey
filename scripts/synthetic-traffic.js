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

// Use the exact person property your cohorts use in PostHog
const PLAN_PROP = 'plan'
const PLAN_BUCKETS = ['Standard', 'Premium', 'Basic']

// Stable acquisition sources (roughly matching your old mix)
const SOURCE_LIST = ['direct', 'newsletter', 'linkedin', 'organic', 'partner', 'referral']
function pickSourceByIndex(i) {
  // 0–39 direct, 40–69 newsletter, 70–94 linkedin, 95 organic, 96 partner, 97+ referral
  const r = i % 100
  if (r < 40) return 'direct'
  if (r < 70) return 'newsletter'
  if (r < 95) return 'linkedin'
  if (r < 97) return 'organic'
  if (r < 99) return 'partner'
  return 'referral'
}

const DEFAULT_POOL_SIZE = Number(process.env.PERSONA_POOL || 400)

// ---------- UTIL ----------
const ensureDir = (p) => fs.existsSync(p) || fs.mkdirSync(p, { recursive: true })

function loadPersonas() {
  ensureDir(STATE_DIR)
  if (fs.existsSync(PERSONAS_FILE)) {
    const personas = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
    // Enrich older persona files that don't have a source yet
    let changed = false
    personas.forEach((p, idx) => {
      if (!p.source) {
        p.source = pickSourceByIndex(idx)
        changed = true
      }
    })
    if (changed) fs.writeFileSync(PERSONAS_FILE, JSON.stringify(personas, null, 2))
    return personas
  }
  const personas = []
  for (let i = 0; i < DEFAULT_POOL_SIZE; i++) {
    const distinct_id = `p_${String(i).padStart(5, '0')}`
    personas.push({
      distinct_id,
      plan: PLAN_BUCKETS[i % PLAN_BUCKETS.length],
      source: pickSourceByIndex(i),
    })
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
    properties: {
      [PLAN_PROP]: person.plan,
      acq_source: person.source,          // helpful person prop
      is_synthetic: true,
    },
  })
}

async function emitDay(person) {
  // Retention driver — now with UTMs so breakdown works
  await posthog.capture({
    distinctId: person.distinct_id,
    event: 'title_opened',
    properties: {
      [PLAN_PROP]: person.plan,
      is_synthetic: true,
      source: person.source,              // custom breakdown
      $utm_source: person.source,         // PostHog standard UTM props
      $utm_medium: 'synthetic',
      $utm_campaign: 'hogflix-bot',
    },
  })

  // Feed your demo fallback actions (keep as-is, add UTMs too)
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
        source: person.source,
        $utm_source: person.source,
        $utm_medium: 'synthetic',
        $utm_campaign: 'hogflix-bot',
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
        source: person.source,
        $utm_source: person.source,
        $utm_medium: 'synthetic',
        $utm_campaign: 'hogflix-bot',
      },
    })
  }
}

async function main() {
  const personas = loadPersonas()
  await Promise.all(personas.map(identifyPerson))
  for (const p of personas) await emitDay(p)

  // posthog-node version on the runner uses non-Async methods
  await posthog.flush()
  await posthog.shutdown()

  savePersonas(personas)
  console.log(`Emitted events for ${personas.length} personas`)
}

main().catch(async (e) => {
  console.error(e)
  try { await posthog.shutdown() } catch {}
  process.exit(1)
})
