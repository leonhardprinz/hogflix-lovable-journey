// Node >= 18, ESM ("type":"module")
import { PostHog } from 'posthog-node'
import fs from 'node:fs'
import path from 'node:path'

// ------------------ CONFIG ------------------
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const PH_PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY
if (!PH_PROJECT_API_KEY) {
  console.error('Missing PH_PROJECT_API_KEY')
  process.exit(1)
}

const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

const PLAN_PROP = 'plan'                       // person property used in reports
const ALT_PLAN_PROP = 'company_plan'           // keep compatibility with older reports

const PLANS = ['Standard', 'Premium', 'Basic']

// mixture similar to your earlier source lines
function pickSourceByIndex(i) {
  const r = i % 100
  if (r < 40) return 'direct'
  if (r < 70) return 'newsletter'
  if (r < 95) return 'linkedin'
  if (r < 97) return 'organic'
  if (r < 99) return 'partner'
  return 'referral'
}

// baseline daily return probability by plan (tuned so retention is not flat 100%)
const BASE_RETURN = { Standard: 0.32, Premium: 0.52, Basic: 0.22 }

// video behavior probabilities
const P_OPEN_TITLE = 0.75            // of active users who open a title
const P_START_VIDEO = 0.60           // of openers who start playback
const P_REACH_50 = 0.55              // of starters who hit >=50%
const P_PLAN_SELECTED = 0.01         // rare conversion event (per-active-user)

// Example content id (your demo video)
const VIDEO_ID = '6f4d68aa-3d28-43eb-a16d-31848741832b'

// ------------------ HELPERS ------------------
const ensureDir = (p) => fs.existsSync(p) || fs.mkdirSync(p, { recursive: true })
const rand = () => Math.random()

function dowFactor(d) {
  // Mild day-of-week preference (more active Fri/Sat, less Mon)
  const day = new Date().getUTCDay()
  return [0.85, 0.9, 0.95, 1.0, 1.1, 1.15, 1.05][day]
}

function loadPersonas(pool = Number(process.env.PERSONA_POOL || 400)) {
  ensureDir(STATE_DIR)
  if (fs.existsSync(PERSONAS_FILE)) {
    const arr = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
    // enrich missing fields for older files
    arr.forEach((p, i) => {
      if (!p.source) p.source = pickSourceByIndex(i)
      if (!p[PLAN_PROP]) p[PLAN_PROP] = PLANS[i % PLANS.length]
      if (p.return_prob == null) p.return_prob = BASE_RETURN[p[PLAN_PROP]] + (rand() - 0.5) * 0.08
      if (!p.created_at) p.created_at = new Date().toISOString()
      if (p.initialized == null) p.initialized = false
    })
    fs.writeFileSync(PERSONAS_FILE, JSON.stringify(arr, null, 2))
    return arr
  }
  const personas = []
  for (let i = 0; i < pool; i++) {
    const plan = PLANS[i % PLANS.length]
    personas.push({
      distinct_id: `p_${String(i).padStart(5, '0')}`,
      [PLAN_PROP]: plan,
      [ALT_PLAN_PROP]: plan,
      source: pickSourceByIndex(i),
      return_prob: BASE_RETURN[plan] + (rand() - 0.5) * 0.08,
      created_at: new Date().toISOString(),
      initialized: false,
    })
  }
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(personas, null, 2))
  return personas
}

function savePersonas(arr) {
  ensureDir(STATE_DIR)
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(arr, null, 2))
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

async function identifyIfNeeded(p) {
  // Set both plan properties + initial UTMs (so "UTM source (initial)" breakdowns work)
  await posthog.identify({
    distinctId: p.distinct_id,
    properties: {
      [PLAN_PROP]: p[PLAN_PROP],
      [ALT_PLAN_PROP]: p[ALT_PLAN_PROP],
      acq_source: p.source,
      is_synthetic: true,
      $initial_utm_source: p.source,
      $initial_utm_medium: 'synthetic',
      $initial_utm_campaign: 'hogflix-bot',
    },
  })
}

function eventPropsBase(p) {
  return {
    [PLAN_PROP]: p[PLAN_PROP],
    [ALT_PLAN_PROP]: p[ALT_PLAN_PROP],
    is_synthetic: true,
    source: p.source,
    $utm_source: p.source,
    $utm_medium: 'synthetic',
    $utm_campaign: 'hogflix-bot',
  }
}

async function emitActiveDay(p) {
  // Optional “section_clicked” to feed your funnel step 1
  await posthog.capture({
    distinctId: p.distinct_id,
    event: 'section_clicked',
    properties: { ...eventPropsBase(p), section: 'Popular' },
  })

  // Some active users actually open a title
  if (rand() < P_OPEN_TITLE) {
    await posthog.capture({
      distinctId: p.distinct_id,
      event: 'title_opened',
      properties: { ...eventPropsBase(p), title_id: VIDEO_ID },
    })

    if (rand() < P_START_VIDEO) {
      await posthog.capture({
        distinctId: p.distinct_id,
        event: 'video_started',
        properties: { ...eventPropsBase(p), video_id: VIDEO_ID },
      })

      if (rand() < P_REACH_50) {
        await posthog.capture({
          distinctId: p.distinct_id,
          event: 'video_progress',
          properties: { ...eventPropsBase(p), video_id: VIDEO_ID, milestone: 50 },
        })
      }
    }
  }

  // Rare: plan conversion
  if (rand() < P_PLAN_SELECTED) {
    await posthog.capture({
      distinctId: p.distinct_id,
      event: 'plan_selected',
      properties: { ...eventPropsBase(p), selected_plan: p[PLAN_PROP] },
    })
  }
}

async function main() {
  const personas = loadPersonas()
  await Promise.all(personas.map(identifyIfNeeded))

  const factor = dowFactor()
  for (const p of personas) {
    const activeToday = rand() < Math.min(Math.max(p.return_prob * factor, 0.02), 0.95)
    if (!activeToday) continue
    await emitActiveDay(p)
  }

  await posthog.flush()
  await posthog.shutdown()
  savePersonas(personas)
  console.log('Synthetic server events done.')
}

main().catch(async (e) => {
  console.error(e)
  try { await posthog.shutdown() } catch {}
  process.exit(1)
})
