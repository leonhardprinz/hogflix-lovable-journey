/**
 * Web Analytics demo seeder - UTM-tagged traffic with conversion events
 *
 * Emits $pageview events with rich UTM + referrer + device + path variety so the
 * Channels, UTM source / medium / campaign, Top Paths, and Bounce Rate tiles in
 * PostHog Web Analytics populate believably. ~5-15% of sessions also fire one of
 * two conversion events (signup_completed or subscription_started) linked to the
 * landing pageview via $session_id.
 *
 * Server-side via posthog-node. Originally implemented with Playwright (real
 * browser) but the deployed SPA + PostHog autocapture-force-start + headless
 * detection + sendBeacon timing make browser-driven seeding unreliable. The
 * server-side path is 100% delivery for the demo-critical data (channels, UTMs,
 * paths, geo, conversions). The "real-browser" properties the WA dashboard cares
 * about ($web_vitals, $autocapture, session replays) continue to come from real
 * users + the existing `scripts/playwright-journey-*.js` browser scripts, which
 * are unchanged.
 *
 * Independent of the existing synthetic-traffic system. Tags every event with
 * synthetic_source: 'web-analytics-demo' so it can be filtered out later.
 *
 * Usage:
 *   node scripts/web-analytics-demo/seed-utm-traffic.js                 # 20 sessions, then exits
 *   node scripts/web-analytics-demo/seed-utm-traffic.js --count 100     # 100 sessions, then exits
 *   node scripts/web-analytics-demo/seed-utm-traffic.js --loop          # runs forever, ~60 sessions/hour
 *   node scripts/web-analytics-demo/seed-utm-traffic.js --loop --rate 30 # runs forever, ~30 sessions/hour
 *
 * Env vars:
 *   POSTHOG_KEY  PostHog project API key (default: same project as the app .env)
 *   POSTHOG_HOST PostHog ingestion host (default: https://eu.i.posthog.com)
 *   APP_HOST     Synthetic $host value (default: hogflix-project.vercel.app)
 *   DEBUG        "true" for per-session logging
 */

// We POST directly to /batch/ instead of using posthog-node so we can set
// $lib: 'web' on the events. posthog-node force-overrides $lib to "posthog-node",
// and PostHog Web Analytics filters its visitor/session counts to events with
// $lib in the web SDK set — so events shipped via posthog-node never show up
// in the Web Analytics dashboard regardless of how complete the properties are.

const POSTHOG_KEY = process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh'
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'
const APP_HOST = process.env.APP_HOST || 'hogflix-project.vercel.app'
const DEBUG = process.env.DEBUG === 'true'

const args = process.argv.slice(2)
const LOOP = args.includes('--loop')
const BACKFILL_DAYS = parseArg('--backfill-days', 0)
const SESSIONS_PER_DAY = parseArg('--sessions-per-day', 80)
const BACKFILL = BACKFILL_DAYS > 0
const COUNT = BACKFILL ? BACKFILL_DAYS * SESSIONS_PER_DAY : parseArg('--count', LOOP ? Infinity : 20)
const SESSIONS_PER_HOUR = parseArg('--rate', 60)
const AVG_SLEEP_MS = Math.round(3600_000 / SESSIONS_PER_HOUR)

function parseArg(flag, fallback) {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx === args.length - 1) return fallback
  const n = Number(args[idx + 1])
  return Number.isFinite(n) ? n : fallback
}

// Returns a Date in the past `days` window, weighted toward recent days
// (gentle growth curve) and toward 10:00-22:00 UTC hours (organic traffic shape).
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

// 7 traffic channels. Channels with utm_* populate the UTM tiles directly;
// channels with only a referrer get classified by PostHog's default channel rules.
const CHANNELS = [
  {
    name: 'Direct',
    weight: 22,
    utm: {},
    referrer: '$direct',
    referring_domain: '$direct',
  },
  {
    name: 'Google CPC',
    weight: 20,
    utm: { utm_source: 'google', utm_medium: 'cpc' },
    campaigns: [
      { utm_campaign: 'spring_sale_2026', utm_content: 'headline_a', utm_term: 'streaming service' },
      { utm_campaign: 'spring_sale_2026', utm_content: 'headline_b', utm_term: 'movies online' },
      { utm_campaign: 'brand_search', utm_content: 'sitelink_pricing', utm_term: 'hogflix' },
      { utm_campaign: 'brand_search', utm_content: 'sitelink_signup', utm_term: 'hogflix signup' },
      { utm_campaign: 'competitor_takeover', utm_content: 'vs_netflix', utm_term: 'netflix alternatives' },
      { utm_campaign: 'competitor_takeover', utm_content: 'vs_disney', utm_term: 'best streaming 2026' },
      { utm_campaign: 'category_streaming', utm_content: 'broadmatch_a', utm_term: 'watch movies' },
    ],
    referrer: 'https://www.google.com/',
    referring_domain: 'www.google.com',
    addClickId: () => ({ gclid: `Cj0KCQjw_${randomId(20)}` }),
  },
  {
    name: 'Facebook Paid Social',
    weight: 12,
    utm: { utm_source: 'facebook', utm_medium: 'paid_social' },
    campaigns: [
      { utm_campaign: 'lookalike_audience_q2', utm_content: 'carousel_v3' },
      { utm_campaign: 'lookalike_audience_q2', utm_content: 'video_15s_v1' },
      { utm_campaign: 'retargeting_pricing_viewers', utm_content: 'static_cta_a' },
      { utm_campaign: 'retargeting_pricing_viewers', utm_content: 'static_cta_b' },
      { utm_campaign: 'prospecting_streaming_intent', utm_content: 'carousel_v1' },
      { utm_campaign: 'prospecting_streaming_intent', utm_content: 'video_30s_v2' },
    ],
    referrer: 'https://www.facebook.com/',
    referring_domain: 'www.facebook.com',
    addClickId: () => ({ fbclid: `IwAR${randomId(24)}` }),
  },
  {
    name: 'Newsletter Email',
    weight: 12,
    utm: { utm_source: 'newsletter', utm_medium: 'email' },
    campaigns: [
      { utm_campaign: 'weekly_digest', utm_content: 'header_cta' },
      { utm_campaign: 'weekly_digest', utm_content: 'inline_recommend' },
      { utm_campaign: 'new_releases_may', utm_content: 'hero_image' },
      { utm_campaign: 'new_releases_may', utm_content: 'footer_cta' },
      { utm_campaign: 'win_back_lapsed', utm_content: 'discount_30' },
      { utm_campaign: 'pre_launch_originals', utm_content: 'teaser_v2' },
    ],
    referrer: '$direct',
    referring_domain: '$direct',
  },
  {
    name: 'Organic Search',
    weight: 11,
    utm: { utm_source: 'google', utm_medium: 'organic' },
    referrer: 'https://www.google.com/',
    referring_domain: 'www.google.com',
  },
  {
    name: 'Twitter Organic Social',
    weight: 8,
    utm: { utm_source: 'twitter', utm_medium: 'organic_social' },
    campaigns: [
      { utm_campaign: 'launch_thread' },
      { utm_campaign: 'founder_post_pinned' },
      { utm_campaign: 'feature_announce_replay' },
    ],
    referrer: 'https://t.co/',
    referring_domain: 't.co',
  },
  {
    name: 'Bing CPC',
    weight: 3,
    utm: { utm_source: 'bing', utm_medium: 'cpc' },
    campaigns: [
      { utm_campaign: 'brand_search_bing', utm_content: 'sitelink_pricing', utm_term: 'hogflix' },
      { utm_campaign: 'category_streaming_bing', utm_content: 'broadmatch', utm_term: 'streaming services' },
    ],
    referrer: 'https://www.bing.com/',
    referring_domain: 'www.bing.com',
    addClickId: () => ({ msclkid: randomId(32).toLowerCase() }),
  },
  {
    name: 'Bing Organic Search',
    weight: 2,
    utm: {},
    referrer: 'https://www.bing.com/',
    referring_domain: 'www.bing.com',
  },
  {
    name: 'DuckDuckGo Organic',
    weight: 2,
    utm: {},
    referrer: 'https://duckduckgo.com/',
    referring_domain: 'duckduckgo.com',
  },
  {
    name: 'Instagram Paid Social',
    weight: 5,
    utm: { utm_source: 'instagram', utm_medium: 'paid_social' },
    campaigns: [
      { utm_campaign: 'reels_creators_q2', utm_content: 'reel_9_16_a' },
      { utm_campaign: 'reels_creators_q2', utm_content: 'reel_9_16_b' },
      { utm_campaign: 'story_ads_genz', utm_content: 'story_static_v1' },
    ],
    referrer: 'https://l.instagram.com/',
    referring_domain: 'l.instagram.com',
    addClickId: () => ({ fbclid: `IwAR${randomId(24)}` }),
  },
  {
    name: 'TikTok Paid Social',
    weight: 4,
    utm: { utm_source: 'tiktok', utm_medium: 'paid_social' },
    campaigns: [
      { utm_campaign: 'genz_streaming_q2', utm_content: 'spark_ad_v1' },
      { utm_campaign: 'genz_streaming_q2', utm_content: 'spark_ad_v2' },
      { utm_campaign: 'creator_collab_jan', utm_content: 'duet_response' },
    ],
    referrer: 'https://www.tiktok.com/',
    referring_domain: 'www.tiktok.com',
    addClickId: () => ({ ttclid: randomId(32) }),
  },
  {
    name: 'LinkedIn Paid Social',
    weight: 3,
    utm: { utm_source: 'linkedin', utm_medium: 'paid_social' },
    campaigns: [
      { utm_campaign: 'sponsored_content_b2b', utm_content: 'carousel_use_cases' },
      { utm_campaign: 'sponsored_content_b2b', utm_content: 'single_image_pricing' },
    ],
    referrer: 'https://www.linkedin.com/',
    referring_domain: 'www.linkedin.com',
    addClickId: () => ({ li_fat_id: randomId(20) }),
  },
  {
    name: 'LinkedIn Organic',
    weight: 3,
    utm: { utm_source: 'linkedin', utm_medium: 'organic_social' },
    campaigns: [
      { utm_campaign: 'team_post_launch' },
      { utm_campaign: 'employee_advocacy' },
    ],
    referrer: 'https://www.linkedin.com/',
    referring_domain: 'www.linkedin.com',
  },
  {
    name: 'TikTok Organic',
    weight: 2,
    utm: { utm_source: 'tiktok', utm_medium: 'organic_social' },
    campaigns: [{ utm_campaign: 'viral_clip_april' }],
    referrer: 'https://www.tiktok.com/',
    referring_domain: 'www.tiktok.com',
  },
  {
    name: 'YouTube Organic Social',
    weight: 3,
    utm: { utm_source: 'youtube', utm_medium: 'organic_social' },
    campaigns: [
      { utm_campaign: 'trailer_drop_may' },
      { utm_campaign: 'creator_review_breakdown' },
    ],
    referrer: 'https://www.youtube.com/',
    referring_domain: 'www.youtube.com',
  },
  {
    name: 'HackerNews Referral',
    weight: 4,
    utm: {},
    referrer: 'https://news.ycombinator.com/',
    referring_domain: 'news.ycombinator.com',
  },
  {
    name: 'Reddit Referral',
    weight: 4,
    utm: {},
    referrer: 'https://www.reddit.com/',
    referring_domain: 'www.reddit.com',
  },
  {
    name: 'ProductHunt Referral',
    weight: 3,
    utm: {},
    referrer: 'https://www.producthunt.com/',
    referring_domain: 'www.producthunt.com',
  },
  {
    name: 'GitHub Referral',
    weight: 2,
    utm: {},
    referrer: 'https://github.com/',
    referring_domain: 'github.com',
  },
  {
    name: 'Medium Referral',
    weight: 2,
    utm: {},
    referrer: 'https://medium.com/',
    referring_domain: 'medium.com',
  },
  {
    name: 'Substack Referral',
    weight: 2,
    utm: {},
    referrer: 'https://substack.com/',
    referring_domain: 'substack.com',
  },
  {
    name: 'Discord Referral',
    weight: 1,
    utm: {},
    referrer: 'https://discord.com/',
    referring_domain: 'discord.com',
  },
]

// Country distribution - moderate spread for UTM seeder (geo seeder handles
// the broader 15-country footprint). Weighted toward markets where the
// channels are typically active.
const COUNTRIES = [
  { code: 'US', name: 'United States', continent: 'NA', weight: 35, cities: ['New York', 'San Francisco', 'Chicago', 'Austin'], tz: 'America/New_York' },
  { code: 'GB', name: 'United Kingdom', continent: 'EU', weight: 14, cities: ['London', 'Manchester'], tz: 'Europe/London' },
  { code: 'DE', name: 'Germany', continent: 'EU', weight: 12, cities: ['Berlin', 'Munich'], tz: 'Europe/Berlin' },
  { code: 'FR', name: 'France', continent: 'EU', weight: 8, cities: ['Paris', 'Lyon'], tz: 'Europe/Paris' },
  { code: 'NL', name: 'Netherlands', continent: 'EU', weight: 6, cities: ['Amsterdam'], tz: 'Europe/Amsterdam' },
  { code: 'CA', name: 'Canada', continent: 'NA', weight: 6, cities: ['Toronto', 'Vancouver'], tz: 'America/Toronto' },
  { code: 'AU', name: 'Australia', continent: 'OC', weight: 5, cities: ['Sydney', 'Melbourne'], tz: 'Australia/Sydney' },
  { code: 'ES', name: 'Spain', continent: 'EU', weight: 4, cities: ['Madrid', 'Barcelona'], tz: 'Europe/Madrid' },
  { code: 'BR', name: 'Brazil', continent: 'SA', weight: 4, cities: ['São Paulo'], tz: 'America/Sao_Paulo' },
  { code: 'IT', name: 'Italy', continent: 'EU', weight: 4, cities: ['Rome', 'Milan'], tz: 'Europe/Rome' },
]

// Landing pages for sessions. Routes verified against src/pages/.
const LANDING_PATHS = [
  { path: '/', weight: 38 },
  { path: '/browse', weight: 25 },
  { path: '/pricing', weight: 15 },
  { path: '/signup', weight: 8 },
  { path: '/faq', weight: 4 },
  { path: '/help', weight: 4 },
  { path: '/flixbuddy', weight: 3 },
  { path: '/login', weight: 3 },
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

const FIRST_NAMES = ['emma', 'olivia', 'liam', 'noah', 'ava', 'sophia', 'mason', 'isabella', 'jacob', 'mia', 'lucas', 'amelia', 'ethan', 'harper', 'logan', 'evelyn', 'caleb', 'abigail', 'jackson', 'ella']
const LAST_NAMES = ['nielsen', 'rossi', 'dubois', 'mueller', 'silva', 'lopez', 'tanaka', 'kowalski', 'andersson', 'jansen', 'martin', 'okonkwo', 'novak', 'jensen', 'fischer', 'romero']
const EMAIL_DOMAINS = ['gmail.com', 'icloud.com', 'outlook.com', 'proton.me', 'yahoo.com', 'fastmail.com']

function weightedPick(pool) {
  const total = pool.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const item of pool) {
    r -= item.weight
    if (r <= 0) return item
  }
  return pool[0]
}

function randomId(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function uuidLike() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function generateEmail() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  const n = Math.floor(Math.random() * 9999)
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)]
  return `${first}.${last}${n}@${domain}`
}

// Direct /batch/ transport — see header comment for why we don't use posthog-node.
const eventQueue = []
const BATCH_SIZE = 100
async function sendOneBatch() {
  if (eventQueue.length === 0) return
  const batch = eventQueue.splice(0, BATCH_SIZE)
  const resp = await fetch(`${POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // PostHog tags events with $lib based on the HTTP User-Agent of the capture call.
      // We need a browser-like UA so events are tagged $lib='web' (the value Web Analytics filters on).
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
  async flush() {
    while (eventQueue.length > 0) await sendOneBatch()
  },
  async shutdown() { await this.flush() },
}

function buildPageviewProps({ landing, channel, country, city, device, sessionId, distinctId, email, isIdentified }) {
  const url = new URL(landing.path, `https://${APP_HOST}`)
  const campaignVariant = channel.campaigns ? channel.campaigns[Math.floor(Math.random() * channel.campaigns.length)] : {}
  const utmAll = { ...channel.utm, ...campaignVariant }
  for (const [key, val] of Object.entries(utmAll)) {
    url.searchParams.set(key, val)
  }
  const clickId = channel.addClickId ? channel.addClickId() : {}
  for (const [key, val] of Object.entries(clickId)) {
    url.searchParams.set(key, val)
  }

  return {
    // Page identity
    $current_url: url.toString(),
    $pathname: landing.path,
    $host: APP_HOST,

    // Session + identity
    $session_id: sessionId,
    $window_id: uuidLike(),
    distinct_id: distinctId,
    ...(isIdentified && email ? { email, $user_id: email } : {}),

    // GeoIP override (disableGeoip below stops the server plugin overwriting)
    $geoip_country_code: country.code,
    $geoip_country_name: country.name,
    $geoip_continent_code: country.continent,
    $geoip_city_name: city,
    $geoip_time_zone: country.tz,

    // Channel attribution
    $referrer: channel.referrer,
    $referring_domain: channel.referring_domain,
    ...utmAll,
    ...clickId,

    // Device / browser
    $device_type: device.type,
    $browser: device.browser,
    $os: device.os,
    $browser_version: device.browser_version,
    $screen_width: device.type === 'Mobile' ? 412 : 1920,
    $screen_height: device.type === 'Mobile' ? 915 : 1080,
    $viewport_width: device.type === 'Mobile' ? 412 : 1440,
    $viewport_height: device.type === 'Mobile' ? 915 : 900,
    $raw_user_agent: device.userAgent,
    $useragent: device.userAgent,

    // Spoof posthog-js so Web Analytics counts these as web traffic (it filters out $lib=posthog-node)
    $lib: 'web',
    $lib_version: '1.362.0',

    // Demo tag
    synthetic_source: 'web-analytics-demo',
    demo_seeder_version: 3,
  }
}

async function runOneSession(sessionIdx) {
  const device = weightedPick(DEVICES)
  const channel = weightedPick(CHANNELS)
  const landing = weightedPick(LANDING_PATHS)
  const country = weightedPick(COUNTRIES)
  const city = country.cities[Math.floor(Math.random() * country.cities.length)]

  const isIdentified = Math.random() < 0.3
  const email = isIdentified ? generateEmail() : null
  const distinctId = isIdentified ? email : uuidLike()
  const sessionId = uuidLike()

  const triggerSignup = Math.random() < 0.08
  const triggerSubscription = Math.random() < 0.06

  if (DEBUG || sessionIdx % 10 === 0) {
    const tag = `[${sessionIdx}] ${channel.name.padEnd(24)} | ${country.code} ${city.padEnd(14)} | ${device.browser.padEnd(15)} | landing=${landing.path}`
    const extras = [isIdentified ? 'ident' : 'anon', triggerSignup ? 'signup' : '', triggerSubscription ? 'sub' : ''].filter(Boolean).join(' ')
    console.log(`${tag} | ${extras}`)
  }

  const baseProps = buildPageviewProps({ landing, channel, country, city, device, sessionId, distinctId, email, isIdentified })

  const sessionTs = BACKFILL ? pickHistoricTimestamp(BACKFILL_DAYS) : null

  // 1. The landing $pageview
  posthog.capture({
    distinctId,
    event: '$pageview',
    properties: baseProps,
    disableGeoip: true,
    ...(sessionTs && { timestamp: sessionTs }),
  })

  // 2. Optional conversion events. Reuse session_id + distinct_id + channel
  // attribution so they link properly to the landing event.
  if (triggerSignup) {
    posthog.capture({
      distinctId,
      event: 'signup_completed',
      properties: {
        ...baseProps,
        $current_url: `https://${APP_HOST}/signup`,
        $pathname: '/signup',
        method: 'email',
        email_provided: isIdentified,
        plan_selected: 'free',
      },
      disableGeoip: true,
      ...(sessionTs && { timestamp: new Date(sessionTs.getTime() + 60_000 + Math.floor(Math.random() * 240_000)) }),
    })
  }

  if (triggerSubscription) {
    const plans = ['basic', 'standard', 'premium']
    const prices = { basic: 9.99, standard: 14.99, premium: 19.99 }
    const plan = plans[Math.floor(Math.random() * plans.length)]
    posthog.capture({
      distinctId,
      event: 'subscription_started',
      properties: {
        ...baseProps,
        $current_url: `https://${APP_HOST}/checkout`,
        $pathname: '/checkout',
        plan,
        price_usd: prices[plan],
        billing_period: 'monthly',
      },
      disableGeoip: true,
      ...(sessionTs && { timestamp: new Date(sessionTs.getTime() + 120_000 + Math.floor(Math.random() * 300_000)) }),
    })
  }

  // 3. ~40% of sessions browse one additional page (lowers bounce rate so it
  // sits in a believable 60-80% range instead of pinned to 100%).
  if (Math.random() < 0.4) {
    const secondPath = LANDING_PATHS[Math.floor(Math.random() * LANDING_PATHS.length)].path
    if (secondPath !== landing.path) {
      posthog.capture({
        distinctId,
        event: '$pageview',
        properties: {
          ...baseProps,
          $current_url: `https://${APP_HOST}${secondPath}`,
          $pathname: secondPath,
          // referrer for the second pageview is the first pageview's URL
          $referrer: baseProps.$current_url,
          $referring_domain: APP_HOST,
        },
        disableGeoip: true,
        ...(sessionTs && { timestamp: new Date(sessionTs.getTime() + 30_000 + Math.floor(Math.random() * 180_000)) }),
      })
    }
  }
}

async function main() {
  console.log(`web-analytics-demo UTM seeder starting`)
  console.log(`  posthog host: ${POSTHOG_HOST}`)
  console.log(`  app host:     ${APP_HOST}`)
  console.log(`  mode:         ${BACKFILL ? `backfill (${BACKFILL_DAYS}d × ${SESSIONS_PER_DAY}/day = ${COUNT} sessions, historic timestamps)` : LOOP ? `loop (${SESSIONS_PER_HOUR}/hr, ~${AVG_SLEEP_MS}ms between)` : `one-shot (${COUNT} sessions)`}`)
  console.log('')

  let stopping = false
  process.on('SIGINT', () => { console.log('\nSIGINT received, flushing and exiting...'); stopping = true })
  process.on('SIGTERM', () => { console.log('\nSIGTERM received, flushing and exiting...'); stopping = true })

  let sessionIdx = 1
  let completedInWindow = 0
  const windowStartedAt = Date.now()

  while (!stopping && sessionIdx <= COUNT) {
    await runOneSession(sessionIdx)
    completedInWindow++
    sessionIdx++

    if (BACKFILL) {
      // Apply backpressure: flush every 100 sessions to avoid queue overflow / dropped events.
      if (sessionIdx % 100 === 0) {
        await posthog.flush()
        if (sessionIdx % 1000 === 0) console.log(`[backfill] flushed at session ${sessionIdx}/${COUNT}`)
      }
      continue
    }

    await posthog.flush()

    if (!LOOP || stopping) continue

    const jitter = 0.5 + Math.random()
    const sleepMs = Math.max(200, Math.round(AVG_SLEEP_MS * jitter))
    await new Promise(r => setTimeout(r, sleepMs))

    if (Date.now() - windowStartedAt > 3600_000) {
      console.log(`[heartbeat] ${new Date().toISOString()} | ${completedInWindow} sessions in the last hour | total ${sessionIdx - 1}`)
      completedInWindow = 0
    }
  }

  await posthog.shutdown()
  console.log(`\nfinished. total sessions: ${sessionIdx - 1}`)
}

main().catch(async err => {
  console.error('fatal:', err)
  await posthog.shutdown().catch(() => {})
  process.exit(1)
})
