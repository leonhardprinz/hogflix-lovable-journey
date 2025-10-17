// scripts/synthetic-traffic.js
// Purpose: optional server-side "heartbeat" events to smooth trendlines.
// Uses PostHog /capture with token from env. Do not put secrets in code.

const https = require('https')

const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY // <-- set in GitHub Secrets
if (!POSTHOG_API_KEY) {
  console.error('Missing POSTHOG_API_KEY env. Set it in GitHub Secrets.')
  process.exit(1)
}

function posthogCapture(event, properties, distinct_id) {
  const payload = JSON.stringify({
    api_key: POSTHOG_API_KEY,
    event,
    properties: {
      ...properties,
      // synthetic markers for filtering
      synthetic: true,
      is_synthetic: true,
      // typical capture props
      $current_url: properties?.$current_url || 'https://hogflix-demo.lovable.app/',
      $lib: 'server',
    },
    distinct_id: distinct_id || `svr-${Math.floor(Math.random() * 1e12)}`,
    timestamp: new Date().toISOString(),
  })

  const url = new URL('/capture/', POSTHOG_HOST)
  const options = {
    method: 'POST',
    hostname: url.hostname,
    path: url.pathname,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.on('data', () => {})
      res.on('end', resolve)
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function run() {
  // Send a handful of benign events (NEVER mark PostHog Demo content)
  const baseProps = {
    utm_source: ['organic', 'referral', 'newsletter'][Math.floor(Math.random() * 3)],
    utm_medium: ['web', 'social', 'email'][Math.floor(Math.random() * 3)],
    utm_campaign: ['weekly', 'promo', 'fall'][Math.floor(Math.random() * 3)],
  }

  await posthogCapture('$pageview', { ...baseProps, $current_url: 'https://hogflix-demo.lovable.app/' })
  await posthogCapture('browse_catalog', { ...baseProps, section: 'popular' })
  await posthogCapture('search', { ...baseProps, q: ['cat', 'hog', 'space'][Math.floor(Math.random() * 3)] })
  // DO NOT emit any event that uses category: "PostHog Demo"
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

module.exports = { run }
