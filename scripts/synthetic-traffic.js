import { PostHog } from 'posthog-node'
import { faker } from '@faker-js/faker'

const PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const SESSIONS = Number(process.env.SESSIONS || 15)

if (!PROJECT_API_KEY) { console.error('Missing PH_PROJECT_API_KEY'); process.exit(1) }

const client = new PostHog(PROJECT_API_KEY, { host: PH_HOST })

// Fake companies + plan tiers
const COMPANIES = [
  { id: 'acme-001',    name: 'Acme Corp',       plan: 'Premium', size: '500-1k',  industry: 'SaaS' },
  { id: 'globex-002',  name: 'Globex GmbH',     plan: 'Standard',size: '100-500', industry: 'E-commerce' },
  { id: 'initech-003', name: 'Initech d.o.o.',  plan: 'Basic',   size: '10-50',   industry: 'Fintech' },
  { id: 'umbrella-004',name: 'Umbrella AG',     plan: 'Standard',size: '1k+',     industry: 'Media' },
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

async function simulateOneSession() {
  const p = pick(PERSONAS)
  const c = pick(COMPANIES)
  const u = pick(UTM)

  const distinctId = `syn_${p.persona}_${faker.string.alphanumeric(8)}`
  const now = new Date()

  // Identify + base person properties
  await client.capture({
    distinctId,
    event: '$identify',
    properties: {
      $set: {
        persona: p.persona,
        device_type: p.device,
        company_id: c.id,
        company_name: c.name,
        company_plan: c.plan,     // Basic | Standard | Premium
        company_size: c.size,
        industry: c.industry,
        utm_source: u.utm_source,
        utm_medium: u.utm_medium,
        utm_campaign: u.utm_campaign,
        source: 'hogflix-bot',
        is_synthetic: true,
      },
      $set_once: { first_seen: now.toISOString() },
    },
    timestamp: now,
  })

  // Navigate a few pages (analytics)
  const routes = ['/', '/popular', '/trending']
  for (const route of routes) {
    await client.capture({
      distinctId,
      event: '$pageview',
      properties: {
        $current_url: `https://hogflix-demo.lovable.app${route}`,
        ...u,
        is_synthetic: true,
      },
    })
    if (route !== '/') {
      await client.capture({
        distinctId,
        event: 'section_clicked',
        properties: {
          section: route.slice(1),
          rank: Math.ceil(Math.random() * 5),
          ...u,
          is_synthetic: true,
        },
    })}
  }

  const title_id = faker.string.uuid()
  await client.capture({ distinctId, event: 'title_opened',   properties: { title_id, from_section: faker.helpers.arrayElement(['popular','trending']), ...u, is_synthetic: true }})
  await client.capture({ distinctId, event: 'video_started',   properties: { title_id, position_sec: 0, ...u, is_synthetic: true }})
  for (const pct of [25, 50, 90]) {
    await client.capture({ distinctId, event: 'video_progress', properties: { title_id, progress_pct: pct, ...u, is_synthetic: true }})
  }
  if (Math.random() < 0.5) {
    await client.capture({ distinctId, event: 'search_performed', properties: { query: faker.word.words(2), results_count: Math.ceil(Math.random()*12), ...u, is_synthetic: true }})
  }
}

async function run() {
  for (let i = 0; i < SESSIONS; i++) await simulateOneSession()
  await client.shutdown()
}
run().catch((e) => { console.error(e); process.exit(1) })
