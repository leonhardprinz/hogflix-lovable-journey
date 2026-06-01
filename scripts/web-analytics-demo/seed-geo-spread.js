/**
 * Web Analytics demo seeder - geographic spread
 *
 * Emits $pageview events with synthetic GeoIP properties so the World Map tile in
 * PostHog Web Analytics shows multi-country distribution instead of US-only.
 *
 * Server-side (no real browser), uses posthog-node + disable_geoip so our manual
 * $geoip_* properties stick instead of being overwritten by the source IP.
 *
 * Independent of the existing synthetic-traffic system. Tags every event with
 * synthetic_source: 'web-analytics-demo-geo' so it can be filtered out later.
 *
 * Usage:
 *   node scripts/web-analytics-demo/seed-geo-spread.js                  # 50 events, then exits
 *   node scripts/web-analytics-demo/seed-geo-spread.js --count 200      # 200 events, then exits
 *   node scripts/web-analytics-demo/seed-geo-spread.js --loop           # runs forever, ~40 events/hour
 *   node scripts/web-analytics-demo/seed-geo-spread.js --loop --rate 60 # runs forever, ~60 events/hour
 *
 * Env vars:
 *   POSTHOG_KEY  PostHog project API key (default: same project as the app .env)
 *   POSTHOG_HOST PostHog ingestion host (default: https://eu.i.posthog.com)
 *   APP_HOST     Synthetic $host value for events (default: hogflix-project.vercel.app)
 *   DEBUG        "true" for per-event logging
 */

// Direct /batch/ transport to set $lib: 'web' (Web Analytics filters by this).
// See seed-utm-traffic.js header for details.

const POSTHOG_KEY = process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh'
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'
const APP_HOST = process.env.APP_HOST || 'hogflix-project.vercel.app'
const DEBUG = process.env.DEBUG === 'true'

const args = process.argv.slice(2)
const LOOP = args.includes('--loop')
const BACKFILL_DAYS = parseArg('--backfill-days', 0)
const EVENTS_PER_DAY = parseArg('--events-per-day', 60)
const BACKFILL = BACKFILL_DAYS > 0
const COUNT = BACKFILL ? BACKFILL_DAYS * EVENTS_PER_DAY : parseArg('--count', LOOP ? Infinity : 50)
const EVENTS_PER_HOUR = parseArg('--rate', 40)
const AVG_SLEEP_MS = Math.round(3600_000 / EVENTS_PER_HOUR)

function parseArg(flag, fallback) {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx === args.length - 1) return fallback
  const n = Number(args[idx + 1])
  return Number.isFinite(n) ? n : fallback
}

const HOUR_WEIGHTS = [0.3,0.2,0.15,0.1,0.1,0.15,0.3,0.5,0.7,0.9,1.0,1.1,1.2,1.3,1.4,1.4,1.3,1.3,1.2,1.1,1.0,0.9,0.7,0.5]
function pickHistoricTimestamp(days) {
  const dayU = Math.random()
  const dayOffset = Math.floor((1 - Math.pow(dayU, 0.6)) * days)
  let totalW = 0
  for (const w of HOUR_WEIGHTS) totalW += w
  let r = Math.random() * totalW
  let hour = 0
  for (let i = 0; i < 24; i++) { r -= HOUR_WEIGHTS[i]; if (r <= 0) { hour = i; break } }
  const now = new Date()
  const date = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOffset,
    hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60)
  ))
  if (date.getTime() > Date.now()) {
    return new Date(Date.now() - Math.floor(Math.random() * 3600_000))
  }
  return date
}

// Country distribution. Weights pick countries proportionally; cities/timezones
// give each country a touch of internal variety so the map looks organic.
const COUNTRIES = [
  { code: 'US', name: 'United States', continent: 'NA', weight: 22, cities: ['New York', 'San Francisco', 'Chicago', 'Austin', 'Seattle'], tz: 'America/New_York' },
  { code: 'GB', name: 'United Kingdom', continent: 'EU', weight: 11, cities: ['London', 'Manchester', 'Bristol'], tz: 'Europe/London' },
  { code: 'DE', name: 'Germany', continent: 'EU', weight: 11, cities: ['Berlin', 'Munich', 'Hamburg'], tz: 'Europe/Berlin' },
  { code: 'FR', name: 'France', continent: 'EU', weight: 8, cities: ['Paris', 'Lyon', 'Marseille'], tz: 'Europe/Paris' },
  { code: 'NL', name: 'Netherlands', continent: 'EU', weight: 7, cities: ['Amsterdam', 'Rotterdam'], tz: 'Europe/Amsterdam' },
  { code: 'ES', name: 'Spain', continent: 'EU', weight: 6, cities: ['Madrid', 'Barcelona'], tz: 'Europe/Madrid' },
  { code: 'IT', name: 'Italy', continent: 'EU', weight: 5, cities: ['Rome', 'Milan'], tz: 'Europe/Rome' },
  { code: 'CA', name: 'Canada', continent: 'NA', weight: 5, cities: ['Toronto', 'Vancouver', 'Montreal'], tz: 'America/Toronto' },
  { code: 'BR', name: 'Brazil', continent: 'SA', weight: 5, cities: ['São Paulo', 'Rio de Janeiro'], tz: 'America/Sao_Paulo' },
  { code: 'AU', name: 'Australia', continent: 'OC', weight: 4, cities: ['Sydney', 'Melbourne'], tz: 'Australia/Sydney' },
  { code: 'JP', name: 'Japan', continent: 'AS', weight: 4, cities: ['Tokyo', 'Osaka'], tz: 'Asia/Tokyo' },
  { code: 'MX', name: 'Mexico', continent: 'NA', weight: 3, cities: ['Mexico City', 'Guadalajara'], tz: 'America/Mexico_City' },
  { code: 'SE', name: 'Sweden', continent: 'EU', weight: 3, cities: ['Stockholm', 'Gothenburg'], tz: 'Europe/Stockholm' },
  { code: 'PL', name: 'Poland', continent: 'EU', weight: 3, cities: ['Warsaw', 'Kraków'], tz: 'Europe/Warsaw' },
  { code: 'IN', name: 'India', continent: 'AS', weight: 3, cities: ['Bangalore', 'Mumbai'], tz: 'Asia/Kolkata' },
]

// Channel mix matches the UTM seeder so the WA story is consistent.
const CHANNELS = [
  { name: 'Direct', weight: 25, utm: {}, referrer: '' },
  { name: 'Google CPC', weight: 18, utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring_sale_2026' }, referrer: 'https://www.google.com/' },
  { name: 'Facebook Paid Social', weight: 12, utm: { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'lookalike_audience_q2' }, referrer: 'https://www.facebook.com/' },
  { name: 'Newsletter Email', weight: 12, utm: { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'weekly_digest' }, referrer: '' },
  { name: 'Organic Search', weight: 12, utm: { utm_source: 'google', utm_medium: 'organic' }, referrer: 'https://www.google.com/' },
  { name: 'Twitter Organic Social', weight: 8, utm: { utm_source: 'twitter', utm_medium: 'organic_social' }, referrer: 'https://t.co/' },
  { name: 'HackerNews Referral', weight: 7, utm: {}, referrer: 'https://news.ycombinator.com/' },
  { name: 'Reddit Referral', weight: 6, utm: {}, referrer: 'https://www.reddit.com/' },
]

const PATHS = [
  { path: '/', weight: 38 },
  { path: '/browse', weight: 22 },
  { path: '/pricing', weight: 14 },
  { path: '/signup', weight: 8 },
  { path: '/faq', weight: 4 },
  { path: '/help', weight: 4 },
  { path: '/flixbuddy', weight: 4 },
  { path: '/about', weight: 3 },
  { path: '/movies/featured', weight: 3 },
]

const DEVICES = [
  { type: 'Desktop', browser: 'Chrome', os: 'Mac OS X', browser_version: 121, weight: 28,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
  { type: 'Desktop', browser: 'Chrome', os: 'Windows', browser_version: 121, weight: 24,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
  { type: 'Desktop', browser: 'Safari', os: 'Mac OS X', browser_version: 17, weight: 14,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15' },
  { type: 'Desktop', browser: 'Firefox', os: 'Windows', browser_version: 122, weight: 10,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0' },
  { type: 'Mobile', browser: 'Mobile Safari', os: 'iOS', browser_version: 17, weight: 14,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1' },
  { type: 'Mobile', browser: 'Chrome', os: 'Android', browser_version: 121, weight: 10,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36' },
]

function weightedPick(pool) {
  const total = pool.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const item of pool) {
    r -= item.weight
    if (r <= 0) return item
  }
  return pool[0]
}

function uuidLike() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const eventQueue = []
const BATCH_SIZE = 100
async function sendOneBatch() {
  if (eventQueue.length === 0) return
  const batch = eventQueue.splice(0, BATCH_SIZE)
  const resp = await fetch(`${POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '<no body>')
    console.error(`batch send failed: ${resp.status} ${body.slice(0, 300)}`)
  }
}
const posthog = {
  capture({ distinctId, event, properties, timestamp, disableGeoip }) {
    eventQueue.push({
      event,
      distinct_id: distinctId,
      properties: { ...properties, ...(disableGeoip ? { $geoip_disable: true } : {}) },
      ...(timestamp && { timestamp: timestamp.toISOString() }),
    })
  },
  async flush() { while (eventQueue.length > 0) await sendOneBatch() },
  async shutdown() { await this.flush() },
}

async function emitOne(idx) {
  const country = weightedPick(COUNTRIES)
  const city = country.cities[Math.floor(Math.random() * country.cities.length)]
  const channel = weightedPick(CHANNELS)
  const path = weightedPick(PATHS).path
  const device = weightedPick(DEVICES)
  const distinctId = uuidLike()
  const sessionId = uuidLike()

  const url = new URL(path, `https://${APP_HOST}`)
  for (const [key, val] of Object.entries(channel.utm)) {
    url.searchParams.set(key, val)
  }

  const properties = {
    // Page identity
    $current_url: url.toString(),
    $pathname: path,
    $host: APP_HOST,

    // Session + identity
    $session_id: sessionId,
    distinct_id: distinctId,

    // GeoIP (override - disable_geoip below stops the server-side plugin from rewriting)
    $geoip_country_code: country.code,
    $geoip_country_name: country.name,
    $geoip_continent_code: country.continent,
    $geoip_city_name: city,
    $geoip_time_zone: country.tz,

    // Channel attribution
    $referrer: channel.referrer || '$direct',
    $referring_domain: channel.referrer ? new URL(channel.referrer).hostname : '$direct',
    ...channel.utm,

    // Device / browser
    $device_type: device.type,
    $browser: device.browser,
    $os: device.os,
    $browser_version: device.browser_version,
    $raw_user_agent: device.userAgent,
    $useragent: device.userAgent,

    $lib: 'web',
    $lib_version: '1.362.0',

    // Demo tag (so we can find / filter these later)
    synthetic_source: 'web-analytics-demo-geo',
    demo_seeder_version: 1,
  }

  posthog.capture({
    distinctId,
    event: '$pageview',
    properties,
    disableGeoip: true, // critical: stops PostHog overwriting our $geoip_* props with the source IP
    ...(BACKFILL && { timestamp: pickHistoricTimestamp(BACKFILL_DAYS) }),
  })

  if (DEBUG || idx % 25 === 0) {
    console.log(`[${idx}] ${country.code} ${country.name.padEnd(16)} | ${channel.name.padEnd(24)} | ${path}`)
  }
}

async function main() {
  console.log(`web-analytics-demo geo seeder starting`)
  console.log(`  posthog host: ${POSTHOG_HOST}`)
  console.log(`  app host:     ${APP_HOST}`)
  console.log(`  mode:         ${BACKFILL ? `backfill (${BACKFILL_DAYS}d × ${EVENTS_PER_DAY}/day = ${COUNT} events, historic timestamps)` : LOOP ? `loop (${EVENTS_PER_HOUR}/hr, ~${AVG_SLEEP_MS}ms between)` : `one-shot (${COUNT} events)`}`)
  console.log('')

  let stopping = false
  process.on('SIGINT', async () => { console.log('\nSIGINT received, flushing and exiting...'); stopping = true })
  process.on('SIGTERM', async () => { console.log('\nSIGTERM received, flushing and exiting...'); stopping = true })

  let idx = 1
  let completedInWindow = 0
  const windowStartedAt = Date.now()

  while (!stopping && idx <= COUNT) {
    await emitOne(idx)
    completedInWindow++
    idx++

    if (BACKFILL) {
      if (idx % 100 === 0) {
        await posthog.flush()
        if (idx % 1000 === 0) console.log(`[backfill] flushed at event ${idx}/${COUNT}`)
      }
      continue
    }

    await posthog.flush()

    if (!LOOP || stopping) continue

    const jitter = 0.5 + Math.random()
    const sleepMs = Math.max(200, Math.round(AVG_SLEEP_MS * jitter))
    await new Promise(r => setTimeout(r, sleepMs))

    if (Date.now() - windowStartedAt > 3600_000) {
      console.log(`[heartbeat] ${new Date().toISOString()} | ${completedInWindow} events in the last hour | total ${idx - 1}`)
      completedInWindow = 0
    }
  }

  await posthog.shutdown()
  console.log(`\nfinished. total events: ${idx - 1}`)
}

main().catch(async err => {
  console.error('fatal:', err)
  await posthog.shutdown().catch(() => {})
  process.exit(1)
})
