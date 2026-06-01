/**
 * Real-browser traffic generator for Web Analytics demo.
 *
 * Drives Chromium against the deployed Hogflix app so events flow through
 * the real posthog-js SDK and populate PostHog's materialized `sessions`
 * table — which is what the Web Analytics dashboard reads from. Server-side
 * /batch/ POSTs (see seed-utm-traffic.js) land in the events table but don't
 * trigger session creation, so they're invisible to Web Analytics tiles.
 *
 * Concurrency: N parallel browser contexts. Each context = one fresh session
 * with random channel/UTM/landing page. Closes after a short journey.
 *
 * Usage:
 *   node scripts/web-analytics-demo/playwright-real-traffic.js                          # 50 sessions, 5 workers
 *   node scripts/web-analytics-demo/playwright-real-traffic.js --count 200              # 200 sessions
 *   node scripts/web-analytics-demo/playwright-real-traffic.js --count 500 --workers 8  # 500 sessions, 8 parallel
 *   node scripts/web-analytics-demo/playwright-real-traffic.js --loop                   # run until Ctrl-C
 */

import { chromium as rawChromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

// Stealth plugin defeats navigator.webdriver / headless markers that posthog-js's
// bot detection uses to bail out without sending events.
rawChromium.use(StealthPlugin())
const chromium = rawChromium

const APP_URL = process.env.APP_URL || 'https://hogflix-project.vercel.app'
const args = process.argv.slice(2)
const LOOP = args.includes('--loop')
const COUNT = parseArg('--count', LOOP ? Infinity : 50)
const WORKERS = parseArg('--workers', 5)
const HEADLESS = !args.includes('--headed')
const DEBUG = process.env.DEBUG === 'true'

function parseArg(flag, fallback) {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx === args.length - 1) return fallback
  const n = Number(args[idx + 1])
  return Number.isFinite(n) ? n : fallback
}

const CHANNELS = [
  { name: 'Direct', weight: 18, build: () => ({ params: {}, referer: null }) },
  { name: 'Google CPC', weight: 16, build: () => {
    const c = pickOne([
      { utm_campaign: 'spring_sale_2026', utm_content: 'headline_a', utm_term: 'streaming service' },
      { utm_campaign: 'brand_search', utm_content: 'sitelink_pricing', utm_term: 'hogflix' },
      { utm_campaign: 'competitor_takeover', utm_content: 'vs_netflix', utm_term: 'netflix alternatives' },
      { utm_campaign: 'category_streaming', utm_content: 'broadmatch_a', utm_term: 'watch movies' },
    ])
    return { params: { utm_source: 'google', utm_medium: 'cpc', gclid: `Cj0KCQjw_${randomId(20)}`, ...c }, referer: 'https://www.google.com/' }
  }},
  { name: 'Facebook Paid', weight: 10, build: () => {
    const c = pickOne([
      { utm_campaign: 'lookalike_audience_q2', utm_content: 'carousel_v3' },
      { utm_campaign: 'retargeting_pricing_viewers', utm_content: 'static_cta_a' },
      { utm_campaign: 'prospecting_streaming_intent', utm_content: 'video_30s_v2' },
    ])
    return { params: { utm_source: 'facebook', utm_medium: 'paid_social', fbclid: `IwAR${randomId(24)}`, ...c }, referer: 'https://www.facebook.com/' }
  }},
  { name: 'Instagram Paid', weight: 6, build: () => {
    const c = pickOne([
      { utm_campaign: 'reels_creators_q2', utm_content: 'reel_9_16_a' },
      { utm_campaign: 'story_ads_genz', utm_content: 'story_static_v1' },
    ])
    return { params: { utm_source: 'instagram', utm_medium: 'paid_social', fbclid: `IwAR${randomId(24)}`, ...c }, referer: 'https://l.instagram.com/' }
  }},
  { name: 'TikTok Paid', weight: 5, build: () => {
    const c = pickOne([
      { utm_campaign: 'genz_streaming_q2', utm_content: 'spark_ad_v1' },
      { utm_campaign: 'creator_collab_jan', utm_content: 'duet_response' },
    ])
    return { params: { utm_source: 'tiktok', utm_medium: 'paid_social', ttclid: randomId(32), ...c }, referer: 'https://www.tiktok.com/' }
  }},
  { name: 'LinkedIn Paid', weight: 3, build: () => ({
    params: { utm_source: 'linkedin', utm_medium: 'paid_social', utm_campaign: 'sponsored_content_b2b', utm_content: 'carousel_use_cases' }, referer: 'https://www.linkedin.com/',
  })},
  { name: 'Bing CPC', weight: 3, build: () => ({
    params: { utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'category_streaming_bing', utm_term: 'streaming services', msclkid: randomId(32).toLowerCase() }, referer: 'https://www.bing.com/',
  })},
  { name: 'Newsletter Email', weight: 10, build: () => {
    const c = pickOne([
      { utm_campaign: 'weekly_digest', utm_content: 'header_cta' },
      { utm_campaign: 'new_releases_may', utm_content: 'hero_image' },
      { utm_campaign: 'win_back_lapsed', utm_content: 'discount_30' },
    ])
    return { params: { utm_source: 'newsletter', utm_medium: 'email', ...c }, referer: null }
  }},
  { name: 'Google Organic', weight: 8, build: () => ({ params: {}, referer: 'https://www.google.com/' }) },
  { name: 'Bing Organic', weight: 2, build: () => ({ params: {}, referer: 'https://www.bing.com/' }) },
  { name: 'DuckDuckGo Organic', weight: 1, build: () => ({ params: {}, referer: 'https://duckduckgo.com/' }) },
  { name: 'Twitter Organic', weight: 5, build: () => ({
    params: { utm_source: 'twitter', utm_medium: 'organic_social', utm_campaign: pickOne(['launch_thread', 'founder_post_pinned', 'feature_announce_replay']) }, referer: 'https://t.co/',
  })},
  { name: 'LinkedIn Organic', weight: 3, build: () => ({
    params: { utm_source: 'linkedin', utm_medium: 'organic_social', utm_campaign: pickOne(['team_post_launch', 'employee_advocacy']) }, referer: 'https://www.linkedin.com/',
  })},
  { name: 'YouTube', weight: 3, build: () => ({
    params: { utm_source: 'youtube', utm_medium: 'organic_social', utm_campaign: pickOne(['trailer_drop_may', 'creator_review_breakdown']) }, referer: 'https://www.youtube.com/',
  })},
  { name: 'HackerNews', weight: 3, build: () => ({ params: {}, referer: 'https://news.ycombinator.com/' }) },
  { name: 'Reddit', weight: 3, build: () => ({ params: {}, referer: 'https://www.reddit.com/' }) },
  { name: 'ProductHunt', weight: 2, build: () => ({ params: {}, referer: 'https://www.producthunt.com/' }) },
  { name: 'GitHub', weight: 2, build: () => ({ params: {}, referer: 'https://github.com/' }) },
  { name: 'Medium', weight: 2, build: () => ({ params: {}, referer: 'https://medium.com/' }) },
  { name: 'Substack', weight: 1, build: () => ({ params: {}, referer: 'https://substack.com/' }) },
  { name: 'Discord', weight: 1, build: () => ({ params: {}, referer: 'https://discord.com/' }) },
]

// Public landing pages only — protected routes (e.g. /browse, /flixbuddy) redirect
// to /, which strips the UTM query params before posthog-js captures the pageview.
// /get-started is the experiment landing (signup_method_test flag): 30% weight to
// generate healthy exposure volume.
const LANDING_PATHS = [
  { path: '/get-started', weight: 30 },
  { path: '/', weight: 22 },
  { path: '/pricing', weight: 16 },
  { path: '/signup', weight: 8 },
  { path: '/login', weight: 6 },
  { path: '/faq', weight: 6 },
  { path: '/help', weight: 4 },
  { path: '/about', weight: 4 },
  { path: '/timeleft-pricing', weight: 4 },
]

const SECOND_PATHS = ['/', '/pricing', '/signup', '/login', '/faq', '/help', '/about', '/get-started']

// Variant-specific conversion rates so the experiment shows a clear-ish result
// in demo-time volumes. Control (form) is more familiar so it converts higher;
// QR has cross-device friction so it converts lower — matches Ako's hypothesis.
const CONVERT_RATE_CONTROL = 0.18
const CONVERT_RATE_QR = 0.10

function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)] }
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

async function runOneSession(browser, sessionIdx) {
  const channel = weightedPick(CHANNELS)
  const landing = weightedPick(LANDING_PATHS).path
  const { params, referer } = channel.build()

  const url = new URL(landing, APP_URL)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const context = await browser.newContext({
    userAgent: pickOne([
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    ]),
    extraHTTPHeaders: referer ? { Referer: referer } : {},
    viewport: { width: 1440, height: 900 },
  })

  const page = await context.newPage()
  let phRequestCount = 0
  page.on('request', req => {
    const u = req.url()
    if (u.includes('posthog') || u.includes('/e/') || u.includes('/batch/') || u.includes('/i/v0/e/')) {
      phRequestCount++
      if (DEBUG) console.log(`  [${sessionIdx}] ph req: ${req.method()} ${u.slice(0, 100)}`)
    }
  })
  if (DEBUG) {
    page.on('console', msg => console.log(`  [${sessionIdx}] console: ${msg.text().slice(0, 200)}`))
    page.on('pageerror', err => console.log(`  [${sessionIdx}] pageerror: ${err.message.slice(0, 200)}`))
  }
  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 25000 })
    // wait for posthog-js to load and fire the first pageview
    await page.waitForTimeout(2500 + Math.random() * 1500)

    // 60% chance: navigate to a second page (lowers bounce rate)
    if (Math.random() < 0.6) {
      const secondPath = pickOne(SECOND_PATHS.filter(p => p !== landing))
      await page.goto(new URL(secondPath, APP_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1500 + Math.random() * 1500)
    }

    // 30% chance: navigate to a third page
    if (Math.random() < 0.3) {
      const thirdPath = pickOne(SECOND_PATHS)
      await page.goto(new URL(thirdPath, APP_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1500 + Math.random() * 1500)
    }

    // Conversion logic. Split into two paths:
    //   (a) /get-started landers — experiment-aware: read the signup_method_test
    //       variant, then convert at the variant-specific rate. Control fills the
    //       inline form; QR navigates to /signup?from=qr&ph_did=<id> to demonstrate
    //       the cross-device handoff + identity stitching.
    //   (b) other landers — generic 8% chance of converting at /signup.
    let didConvert = false
    let exposedVariant = null
    if (landing === '/get-started') {
      try {
        // Give posthog-js + the flag fetch a moment to settle so the variant is resolved.
        await page.waitForTimeout(2500)
        exposedVariant = await page.evaluate(() =>
          window.posthog && typeof window.posthog.getFeatureFlag === 'function'
            ? window.posthog.getFeatureFlag('signup_method_test')
            : null
        ).catch(() => null)

        const targetRate = exposedVariant === 'qr' ? CONVERT_RATE_QR : CONVERT_RATE_CONTROL
        if (Math.random() < targetRate) {
          if (exposedVariant === 'qr') {
            // QR variant: read original distinct_id, simulate the user "scanning" the QR
            // by navigating to /signup?from=qr&ph_did=<id> directly. The Signup page
            // aliases the carried ph_did to the new device's distinct_id.
            const phDid = await page.evaluate(() => window.posthog?.get_distinct_id?.()).catch(() => null)
            const qrTarget = new URL('/signup', APP_URL)
            qrTarget.searchParams.set('from', 'qr')
            if (phDid) qrTarget.searchParams.set('ph_did', phDid)
            await page.goto(qrTarget.toString(), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
            await page.waitForTimeout(1500)
            const fakeEmail = `qr-${randomId(10).toLowerCase()}@${pickOne(['gmail.com', 'icloud.com', 'outlook.com'])}`
            const fakeBirth = `${1980 + Math.floor(Math.random() * 25)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`
            await page.fill('#email', fakeEmail).catch(() => {})
            await page.fill('#password', `Demo-${randomId(10)}!`).catch(() => {})
            await page.fill('#birthDate', fakeBirth).catch(() => {})
            await page.waitForTimeout(400)
            await page.click('button[type="submit"]').catch(() => {})
          } else {
            // control variant: inline form on /get-started
            const fakeEmail = `form-${randomId(10).toLowerCase()}@${pickOne(['gmail.com', 'icloud.com', 'outlook.com'])}`
            await page.fill('#email', fakeEmail).catch(() => {})
            await page.waitForTimeout(300)
            await page.click('button[type="submit"]').catch(() => {})
          }
          await Promise.race([
            page.waitForRequest(req => req.method() === 'POST' && (req.url().includes('/e/') || req.url().includes('/i/v0/e/')), { timeout: 8000 }).catch(() => {}),
            page.waitForTimeout(7000),
          ])
          didConvert = true
        }
      } catch {}
    } else if (Math.random() < 0.08) {
      // generic non-experiment conversion path for variety
      try {
        if (!page.url().includes('/signup')) {
          await page.goto(new URL('/signup', APP_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 15000 })
          await page.waitForTimeout(1500)
        }
        const fakeEmail = `demo-${randomId(10).toLowerCase()}@${pickOne(['gmail.com', 'icloud.com', 'outlook.com', 'proton.me'])}`
        const fakeBirth = `${1980 + Math.floor(Math.random() * 25)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`
        await page.fill('#email', fakeEmail).catch(() => {})
        await page.fill('#password', `Demo-${randomId(10)}!`).catch(() => {})
        await page.fill('#birthDate', fakeBirth).catch(() => {})
        await page.waitForTimeout(400)
        await page.click('button[type="submit"]').catch(() => {})
        await Promise.race([
          page.waitForRequest(req => req.method() === 'POST' && (req.url().includes('/e/') || req.url().includes('/i/v0/e/')), { timeout: 8000 }).catch(() => {}),
          page.waitForTimeout(7000),
        ])
        didConvert = true
      } catch {}
    }

    // CRITICAL: wait for posthog-js to actually POST the captured events.
    // posthog-js batches and sends on a timer; without the explicit wait,
    // the context closes before the request goes on the wire and we lose the session.
    await Promise.race([
      page.waitForRequest(req => {
        const u = req.url()
        return (u.includes('/e/') || u.includes('/i/v0/e/') || u.includes('/batch/')) && req.method() === 'POST'
      }, { timeout: 15000 }).catch(() => {}),
      page.waitForTimeout(15000),
    ])
    // Extra grace for any in-flight network
    await page.waitForTimeout(2000)

    const variantTag = exposedVariant ? `[${exposedVariant}]` : ''
    console.log(`[${sessionIdx}] ${channel.name.padEnd(20)} | landing=${landing.padEnd(12)} | ${(params.utm_campaign || '-').padEnd(28)} | ${variantTag.padEnd(10)} | ${didConvert ? 'CONVERTED' : '         '} | ph_requests=${phRequestCount}`)
  } catch (err) {
    if (DEBUG) console.error(`[${sessionIdx}] error: ${err.message}`)
  } finally {
    await context.close().catch(() => {})
  }
}

async function main() {
  console.log(`playwright real-browser traffic generator`)
  console.log(`  target:    ${APP_URL}`)
  console.log(`  mode:      ${LOOP ? 'loop (Ctrl-C to stop)' : `${COUNT} sessions`}`)
  console.log(`  workers:   ${WORKERS} parallel`)
  console.log(`  headless:  ${HEADLESS}`)
  console.log('')

  let stopping = false
  process.on('SIGINT', () => { console.log('\nSIGINT — finishing current sessions then exiting...'); stopping = true })
  process.on('SIGTERM', () => { stopping = true })

  const browser = await chromium.launch({ headless: HEADLESS })

  let nextIdx = 1
  let completed = 0

  async function worker() {
    while (!stopping && nextIdx <= COUNT) {
      const myIdx = nextIdx++
      await runOneSession(browser, myIdx)
      completed++
    }
  }

  const workers = Array.from({ length: WORKERS }, () => worker())
  await Promise.all(workers)

  await browser.close()
  console.log(`\nfinished. completed ${completed} sessions.`)
}

main().catch(err => {
  console.error('fatal:', err)
  process.exit(1)
})
