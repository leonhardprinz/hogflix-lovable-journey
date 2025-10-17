// scripts/synthetic/run.ts
// Purpose: Generate organic-looking, returning traffic using Playwright personas.
// - Persists storage state per persona (.personas/*.json) so PostHog $device_id is stable.
// - Schedules lifelike revisits (D1/D2/D7 patterns).
// - NEVER visits the /demos area (so no "PostHog Demo" events).
// - Appends ?synthetic=1 so your frontend registers { synthetic: true, is_synthetic: true }.

import { chromium, devices } from 'playwright'
import fs from 'fs'
import path from 'path'

type Persona = {
  id: string
  ua: string
  locale: string
  nextVisitAt: number
  affinity?: string[]
}

const SITE = process.env.HOGFLIX_URL || 'https://hogflix-demo.lovable.app/'
const STATE_DIR = path.join(process.cwd(), '.personas')
const DB = path.join(STATE_DIR, 'personas.json')

// ---------- helpers ----------
function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR)
}

function loadPersonas(): Persona[] {
  if (!fs.existsSync(DB)) {
    const now = Date.now()
    const seed: Persona[] = Array.from({ length: 120 }).map((_, i) => ({
      id: `syn-${i + 1}`,
      ua: i % 3 === 0 ? devices['iPhone 13'].userAgent : devices['Desktop Chrome'].userAgent,
      locale: i % 2 === 0 ? 'de-DE' : 'sl-SI',
      nextVisitAt: now + Math.floor(Math.random() * 3 * 60 * 60 * 1000),
      affinity: i % 2 ? ['kids', 'family'] : ['sci-fi', 'drama'],
    }))
    fs.writeFileSync(DB, JSON.stringify(seed, null, 2))
  }
  return JSON.parse(fs.readFileSync(DB, 'utf8'))
}

function savePersonas(p: Persona[]) {
  fs.writeFileSync(DB, JSON.stringify(p, null, 2))
}

function statePath(id: string) {
  return path.join(STATE_DIR, `${id}.json`)
}

// schedule realistic revisits
function scheduleNext(p: Persona) {
  const r = Math.random()
  const hours =
    r < 0.30 ? 20 + Math.random() * 8 :        // ~Day 1
    r < 0.55 ? 48 + Math.random() * 24 :       // Day 2–3
    r < 0.85 ? 96 + Math.random() * 72 :       // Day 4–7
               24 + Math.random() * 24         // occasional next day
  p.nextVisitAt = Date.now() + Math.floor(hours * 3600 * 1000)
}

async function visit(p: Persona) {
  const stateFile = statePath(p.id)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: p.ua,
    locale: p.locale,
    storageState: fs.existsSync(stateFile) ? stateFile : undefined,
  })
  const page = await context.newPage()

  // Build a synthetic landing URL with UTM + synthetic=1
  const url = new URL(SITE)
  url.searchParams.set('synthetic', '1')
  url.searchParams.set('utm_source', ['organic', 'referral', 'newsletter', 'partner'][Math.floor(Math.random() * 4)])
  url.searchParams.set('utm_medium', ['web', 'social', 'email'][Math.floor(Math.random() * 3)])
  url.searchParams.set('utm_campaign', ['fall', 'weekly', 'promo'][Math.floor(Math.random() * 3)])

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('load', { timeout: 60_000 })

  // Mark session synthetic at runtime too (belt & suspenders)
  await page.evaluate(() => {
    // @ts-ignore
    if (window.posthog?.register) {
      // Ensures EVERY event in this session carries these props
      // Your frontend "before_send" drops Demo events when synthetic is true.
      // Also helps Internal/Test Users toggle and Transformations.
      // @ts-ignore
      window.posthog.register({ synthetic: true, is_synthetic: true, source: 'sim' })
    }
  })

  // Dwell, then click a few safe links (never /demos)
  await page.waitForTimeout(1000 + Math.random() * 2000)

  // Pick some links that do NOT include '/demos'
  const anchors = await page.$$eval('a[href]', (els) =>
    els.map((a) => (a as HTMLAnchorElement).href).filter((h) =>
      !!h && !h.includes('/demos') && !h.match(/\/demo(s)?\b/i)
    )
  )

  const toClick = anchors.sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 3))
  for (const href of toClick) {
    try {
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForLoadState('load', { timeout: 45_000 })
      await page.waitForTimeout(800 + Math.random() * 1800)
    } catch { /* ignore soft nav errors */ }
  }

  // Try to play a generic <video> briefly (if present), still NOT in /demos
  try {
    await page.evaluate(async () => {
      const v = document.querySelector('video') as HTMLVideoElement | null
      if (v) {
        try { await v.play() } catch {}
      }
    })
    await page.waitForTimeout(15_000 + Math.random() * 60_000)
  } catch { /* ignore */ }

  // Persist cookie/localStorage (PostHog device id)
  await context.storageState({ path: stateFile })
  await browser.close()
}

async function main() {
  ensureDir()
  const personas = loadPersonas()

  // run a subset that's due
  const due = personas.filter((p) => p.nextVisitAt <= Date.now())
  const batch = due.slice(0, 25) // cap to avoid spikes
  for (const p of batch) {
    await visit(p)
    scheduleNext(p)
  }

  // If none were due (first runs), kick a small seed batch
  if (batch.length === 0) {
    const seed = personas.slice(0, 10)
    for (const p of seed) {
      await visit(p)
      scheduleNext(p)
    }
  }

  savePersonas(personas)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
