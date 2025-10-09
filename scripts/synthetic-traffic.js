// scripts/synthetic-traffic.js
// ESM. Generates synthetic HogFlix engagement for PostHog.
// Modes:
//   BACKFILL: set BACKFILL_WEEKS>0 (manual workflow) – writes past weeks with return behavior.
//   LIVE (default): realistic ongoing traffic with hour/day/growth variance.
//
// Common env: PH_PROJECT_API_KEY, PH_HOST
//
// Backfill env (run via hogflix-backfill.yml):
//   BACKFILL_WEEKS=8         // how many whole weeks to backfill (0=off)
//   USERS_PER_WEEK=40        // seed users per week
//   WEEKLY_GROWTH_PCT=3      // +% more users per more recent week
//   RETURN_RATE=0.45         // % who also "return" the next week
//
// Live env (scheduled hogflix-synthetic.yml):
//   BASE_SESSIONS=28         // baseline sessions per run
//   WEEKLY_GROWTH_PCT=2      // gentle growth over time
//   WEEKEND_DAMPEN=0.65      // weekend multiplier (0..1)
//   EOM_DROOP_PCT=15         // dip in last 5 days of month
//   NOISE_PCT=25             // ± random variation %

import { PostHog } from 'posthog-node'
import { faker } from '@faker-js/faker'

// ---------- Env ----------
const PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'

const BACKFILL_WEEKS = Number(process.env.BACKFILL_WEEKS || 0)
const USERS_PER_WEEK = Number(process.env.USERS_PER_WEEK || 40)
const WEEKLY_GROWTH_PCT = Number(process.env.WEEKLY_GROWTH_PCT || 3)
const RETURN_RATE = Number(process.env.RETURN_RATE || 0.45)

const BASE_SESSIONS = Number(process.env.BASE_SESSIONS || 28)
const WEEKEND_DAMPEN = Number(process.env.WEEKEND_DAMPEN || 0.65)
const EOM_DROOP_PCT = Number(process.env.EOM_DROOP_PCT || 15)
const NOISE_PCT = Number(process.env.NOISE_PCT || 25)

// ---------- Setup ----------
if (!PROJECT_API_KEY) {
  console.error('Missing PH_PROJECT_API_KEY'); process.exit(1)
}
const client = new PostHog(PROJECT_API_KEY, { host: PH_HOST })

// Company mix (approx): Standard 50%, Basic 25%, Premium 25%
// Adjust by duplicating entries if you want a different split.
const COMPANIES = [
  { id: 'acme-001',    name: 'Acme Corp',       plan: 'Premium',  size: '500-1k',  industry: 'SaaS' },
  { id: 'globex-002',  name: 'Globex GmbH',     plan: 'Standard', size: '100-500', industry: 'E-commerce' },
  { id: 'initech-003', name: 'Initech d.o.o.',  plan: 'Basic',    size: '10-50',   industry: 'Fintech' },
  { id: 'umbrella-004',name: 'Umbrella AG',     plan: 'Standard', size: '1k+',     industry: 'Media' },
]

const PERSONAS = [
  { persona: 'binge_watcher', device: 'desktop' },
  { persona: 'casual_mobile', device: 'mobile' },
  { persona: 'searcher',      device: 'desktop' },
]

const UTM = [
  { utm_source: 'linkedin',   utm_medium: 'paid',  utm_campaign: 'hogflix_launch' },
  { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'q4_updates' },
  { utm_source: 'direct',     utm_medium: 'none',  utm_campaign: 'none' },
]

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)]

// ---------- Time helpers ----------
function startOfDayUTC(d = new Date()) {
  const x = new Date(d); x.setUTCHours(0,0,0,0); return x
}
function daysAgo(n) {
  const d = startOfDayUTC()
  d.setUTCDate(d.getUTCDate() - n)
  // anchor around midday UTC to avoid boundary weirdness
  d.setUTCHours(11, 0, 0, 0)
  return d
}

// ---------- Live variance shaping ----------
const HOURLY_WEIGHTS = [
  0.10,0.07,0.06,0.06,0.07,0.10, // 0-5
  0.35,0.55,0.85,1.00,1.00,0.95, // 6-11
  0.95,0.90,0.85,0.80,0.75,0.70, // 12-17
  0.55,0.45,0.35,0.25,0.18,0.12  // 18-23
]
function dowWeight(d) {
  const w = d.getUTCDay() // Sun=0..Sat=6
  if (w === 0) return 0.70
  if (w === 6) return WEEKEND_DAMPEN
  if (w === 5) return 0.9
  return 1.0
}
function eomWeight(d) {
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate()
  const isLast5 = d.getUTCDate() > lastDay - 5
  return isLast5 ? (1 - EOM_DROOP_PCT/100) : 1.0
}
function weeklyGrowthFactor(d, pct = WEEKLY_GROWTH_PCT) {
  const baseline = new Date(Date.UTC(2025, 7, 1)) // 2025-08-01 UTC
  const msPerWeek = 7*24*3600*1000
  const w = Math.floor((d - baseline) / msPerWeek)
  return Math.pow(1 + pct/100, Math.max(0, w))
}
function jitter(base, pct = NOISE_PCT) {
  const delta = (Math.random()*2 - 1) * (pct/100)
  return Math.max(0, Math.round(base * (1 + delta)))
}

// ---------- Event sim ----------
async function identifyOnce(distinctId, personProps, ts) {
  await client.capture({
    distinctId,
    event: '$identify',
    properties: { $set: personProps, $set_once: { first_seen: ts.toISOString() } },
    timestamp: ts,
  })
}
async function simulateSessionAt(distinctId, profile, ts) {
  const { company, utm } = profile
  const routes = ['/', '/popular', '/trending']

  for (const route of routes) {
    await client.capture({
      distinctId, event: '$pageview',
      properties: { $current_url: `https://hogflix-demo.lovable.app${route}`, ...utm, is_synthetic: true },
      timestamp: ts,
    })
    if (route !== '/') {
      await client.capture({
        distinctId, event: 'section_clicked',
        properties: { section: route.slice(1), rank: Math.ceil(Math.random()*5), ...utm, is_synthetic: true },
        timestamp: ts,
      })
    }
  }

  const title_id = faker.string.uuid()
  await client.capture({ distinctId, event: 'title_opened', properties: { title_id, from_section: faker.helpers.arrayElement(['popular','trending']), ...utm, is_synthetic: true }, timestamp: ts })
  await client.capture({ distinctId, event: 'video_started', properties: { title_id, position_sec: 0, ...utm, is_synthetic: true }, timestamp: ts })
  for (const pct of [25,50,90]) {
    await client.capture({ distinctId, event: 'video_progress', properties: { title_id, progress_pct: pct, ...utm, is_synthetic: true }, timestamp: ts })
  }

  if (Math.random() < 0.25) {
    await client.capture({ distinctId, event: 'plan_selected', properties: { plan: company.plan, is_synthetic: true }, timestamp: ts })
    await client.capture({ distinctId, event: '$set', properties: { $set: { company_plan: company.plan } }, timestamp: ts })
  }
}
function makeProfile() {
  const p = pick(PERSONAS)
  const c = pick(COMPANIES)
  const u = pick(UTM)
  return {
    persona: p.persona,
    device: p.device,
    company: c,
    utm: u,
    personProps: {
      persona: p.persona,
      device_type: p.device,
      company_id: c.id,
      company_name: c.name,
      company_plan: c.plan,    // Basic | Standard | Premium
      company_size: c.size,
      industry: c.industry,
      utm_source: u.utm_source,
      utm_medium: u.utm_medium,
      utm_campaign: u.utm_campaign,
      source: 'hogflix-bot',
      is_synthetic: true,
    }
  }
}

// ---------- Backfill mode (fixed: always in the past) ----------
async function runBackfill() {
  // For each week w (0 = current, BACKFILL_WEEKS = oldest):
  // pick a day strictly in the past: daysBack = 7*w + rand(0..6)
  // Then ts = daysAgo(daysBack). This never creates future timestamps.
  for (let w = BACKFILL_WEEKS; w >= 0; w--) {
    const grow = Math.pow(1 + WEEKLY_GROWTH_PCT/100, BACKFILL_WEEKS - w)
    const usersThisWeek = Math.max(1, Math.round(USERS_PER_WEEK * grow))

    for (let i = 0; i < usersThisWeek; i++) {
      const profile = makeProfile()
      const distinctId = `syn_${profile.persona}_${faker.string.alphanumeric(10)}`
      const daysBack = 7*w + Math.floor(Math.random()*7) // 0..6 within that week back
      const ts = daysAgo(daysBack)                        // strictly <= now

      await identifyOnce(distinctId, profile.personProps, ts)
      await simulateSessionAt(distinctId, profile, ts)

      // Return the next more recent week?
      if (w > 0 && Math.random() < RETURN_RATE) {
        const daysBack2 = 7*(w-1) + Math.floor(Math.random()*7)
        const ts2 = daysAgo(daysBack2)
        await simulateSessionAt(distinctId, profile, ts2)
      }
    }
  }
}

// ---------- Live mode ----------
async function runLive() {
  const now = new Date()
  const hourW = HOURLY_WEIGHTS[now.getUTCHours()] || 1
  const dowW = dowWeight(now)
  const eomW = eomWeight(now)
  const growthW = weeklyGrowthFactor(now)

  const raw = BASE_SESSIONS * hourW * dowW * eomW * growthW
  const sessions = jitter(raw, NOISE_PCT)

  for (let i = 0; i < sessions; i++) {
    const profile = makeProfile()
    const distinctId = `syn_${profile.persona}_${faker.string.alphanumeric(10)}`
    await identifyOnce(distinctId, profile.personProps, now)
    await simulateSessionAt(distinctId, profile, now)
  }
}

// ---------- Main ----------
;(async () => {
  if (BACKFILL_WEEKS > 0) {
    console.log(`Running BACKFILL for ${BACKFILL_WEEKS} weeks…`)
    await runBackfill()
  } else {
    await runLive()
  }
  await client.shutdown()
})().catch((e) => { console.error(e); process.exit(1) })
