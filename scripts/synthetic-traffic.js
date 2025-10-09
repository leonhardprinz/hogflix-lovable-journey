const { PostHog } = require('posthog-node')
const { faker } = require('@faker-js/faker')

const PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const SESSIONS = Number(process.env.SESSIONS || 12)

if (!PROJECT_API_KEY) {
  console.error('Missing PH_PROJECT_API_KEY env var')
  process.exit(1)
}

const client = new PostHog(PROJECT_API_KEY, { host: PH_HOST })

const PERSONAS = [
  { persona: 'binge_watcher', device: 'desktop' },
  { persona: 'casual_mobile', device: 'mobile' },
  { persona: 'searcher', device: 'desktop' },
]

function pick(xs) { return xs[Math.floor(Math.random() * xs.length)] }

async function simulateOneSession() {
  const p = pick(PERSONAS)
  const distinctId = `syn_${p.persona}_${faker.string.alphanumeric(8)}`
  const now = new Date()

  await client.capture({
    distinctId,
    event: '$identify',
    properties: { $set: { persona: p.persona, device_type: p.device, is_synthetic: true, source: 'hogflix-bot' } },
    timestamp: now,
  })

  const routes = ['/', '/popular', '/trending']
  for (const route of routes) {
    await client.capture({
      distinctId,
      event: '$pageview',
      properties: { $current_url: `https://hogflix-demo.lovable.app${route}`, is_synthetic: true },
    })
    if (route !== '/') {
      await client.capture({
        distinctId,
        event: 'section_clicked',
        properties: { section: route.slice(1), rank: Math.ceil(Math.random() * 5), is_synthetic: true },
      })
    }
  }

  const title_id = faker.string.uuid()
  await client.capture({ distinctId, event: 'title_opened', properties: { title_id, from_section: pick(['popular','trending']), is_synthetic: true }})
  await client.capture({ distinctId, event: 'video_started', properties: { title_id, position_sec: 0, is_synthetic: true }})
  for (const pct of [25, 50, 90]) {
    await client.capture({ distinctId, event: 'video_progress', properties: { title_id, progress_pct: pct, is_synthetic: true }})
  }

  if (Math.random() < 0.5) {
    await client.capture({ distinctId, event: 'search_performed', properties: { query: faker.word.words(2), results_count: Math.ceil(Math.random()*12), is_synthetic: true }})
  }
}

;(async () => {
  for (let i = 0; i < SESSIONS; i++) await simulateOneSession()
  await client.shutdown()
})()
