// scripts/synthetic/run.ts
import { chromium, devices } from 'playwright'   // npm i -D playwright
import fs from 'fs'
import path from 'path'

type Persona = {
  id: string
  ua: string
  locale: string
  nextVisitAt: number
  interestTags: string[]
}

const SITE = 'https://hogflix-demo.lovable.app/' // your Lovable URL
const PERSONA_DIR = path.join(process.cwd(), '.personas')
const DB = path.join(PERSONA_DIR, 'personas.json')

// --- helpers ---
function ensureDirs() { if (!fs.existsSync(PERSONA_DIR)) fs.mkdirSync(PERSONA_DIR) }
function loadPersonas(): Persona[] {
  if (!fs.existsSync(DB)) {
    const now = Date.now()
    const seed: Persona[] = Array.from({ length: 120 }).map((_, i) => ({
      id: `syn-${i + 1}`,
      ua: i % 3 ? devices['Desktop Chrome'].userAgent : devices['iPhone 13'].userAgent,
      locale: i % 3 ? 'de-DE' : 'sl-SI',
      nextVisitAt: now + Math.floor(Math.random() * 3 * 60 * 60 * 1000), // 0–3h
      interestTags: i % 2 ? ['sci-fi', 'drama'] : ['kids', 'family'],
    }))
    fs.writeFileSync(DB, JSON.stringify(seed, null, 2))
  }
  return JSON.parse(fs.readFileSync(DB, 'utf8'))
}
function savePersonas(p: Persona[]) { fs.writeFileSync(DB, JSON.stringify(p, null, 2)) }
function storageStatePath(id: string) { return path.join(PERSONA_DIR, `${id}.json`) }
function scheduleNextVisit(p: Persona) {
  // simple “lifelike” cadence: 30% D1, 15% D2–D3, 5% weekly
  const r = Math.random()
  const hours =
    r < 0.30 ? 20 + Math.random() * 10 :        // ~day 1
    r < 0.45 ? 48 + Math.random() * 24 :        // day 2–3
    r < 0.80 ? 96 + Math.random() * 72 :        // day 4–7
               24 + Math.random() * 24          // occasional next day
  p.nextVisitAt = Date.now() + Math.floor(hours * 3600 * 1000)
}

async function session(p: Persona) {
  const stateFile = storageStatePath(p.id)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    userAgent: p.ua,
    locale: p.locale,
    storageState: fs.existsSync(stateFile) ? stateFile : undefined,
  })
  const page = await context.newPage()

  const url = new URL(SITE)
  url.searchParams.set('utm_source', ['organic','referral','newsletter','partner'][Math.floor(Math.random()*4)])
  url.searchParams.set('synthetic', '1') // for your own debugging if you want
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })

  // Mark all events from this session as synthetic + identify person
  await page.addInitScript(() => {
    // @ts-ignore
    window.__synthetic = true
  })
  await page.waitForLoadState('load')

  await page.evaluate(async (id) => {
    // @ts-ignore
    if (window.posthog?.register) {
      // event-level super property on every event:
      // (works for $pageview, autocapture, and your custom events)
      window.posthog.register({ synthetic: true, source: 'sim' })
    }
    // Also tag the person profile so “Filter out internal/test users” can hide them
    // @ts-ignore
    const ph = window.posthog
    if (ph?.get_distinct_id && ph?.identify) {
      const did = ph.get_distinct_id()
      ph.identify(did, { synthetic: true, persona_id: id })
    }
  }, p.id)

  // Browse like a human
  await page.waitForTimeout(1000 + Math.random() * 2000)
  // open a non-demo category
  await page.click('text=Popular').catch(() => {})
  await page.waitForTimeout(500 + Math.random() * 1500)
  // open a random title (avoid PostHog Demo explicitly)
  const cards = await page.locator('[data-title-card]').all()
  if (cards.length) await cards[Math.floor(Math.random() * cards.length)].click().catch(()=>{})
  await page.waitForTimeout(1200 + Math.random()*2500)

  // maybe watch a bit (but **never** open Demo pages)
  if (Math.random() < 0.6) {
    // try to find a <video> on current page and play ~30–180s
    await page.evaluate(async () => {
      const v = document.querySelector('video') as HTMLVideoElement | null
      if (v) {
        await v.play().catch(() => {})
      }
    })
    await page.waitForTimeout(30000 + Math.random() * 150000)
  }

  // save cookies / localStorage → keeps PostHog device id stable
  await context.storageState({ path: stateFile })
  await browser.close()
}

// run a subset each invocation (for cron)
;(async () => {
  ensureDirs()
  const all = loadPersonas()
  const due = all.filter(p => p.nextVisitAt <= Date.now())
  const batch = due.slice(0, 25) // cap per run
  for (const p of batch) {
    await session(p)
    scheduleNextVisit(p)
  }
  savePersonas(all)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
