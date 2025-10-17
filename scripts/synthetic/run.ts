import { chromium, devices } from 'playwright'
import fs from 'fs'
import path from 'path'

type Persona = {
  id: string
  ua: string
  locale: string
  nextVisitAt: number
}

const SITE = 'https://hogflix-demo.lovable.app/'
const STATE_DIR = path.join(process.cwd(), '.personas')
const DB = path.join(STATE_DIR, 'personas.json')

function ensure() { if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR) }
function load(): Persona[] {
  if (!fs.existsSync(DB)) {
    const now = Date.now()
    const seed: Persona[] = Array.from({ length: 120 }).map((_, i) => ({
      id: `syn-${i + 1}`,
      ua: i % 2 ? devices['Desktop Chrome'].userAgent : devices['iPhone 13'].userAgent,
      locale: i % 2 ? 'de-DE' : 'sl-SI',
      nextVisitAt: now + Math.floor(Math.random() * 3 * 60 * 60 * 1000),
    }))
    fs.writeFileSync(DB, JSON.stringify(seed, null, 2))
  }
  return JSON.parse(fs.readFileSync(DB, 'utf8'))
}
function save(p: Persona[]) { fs.writeFileSync(DB, JSON.stringify(p, null, 2)) }
function statePath(id: string) { return path.join(STATE_DIR, `${id}.json`) }
function scheduleNext(p: Persona) {
  const r = Math.random()
  const hours =
    r < 0.30 ? 22 + Math.random() * 6 :        // ~D1
    r < 0.50 ? 48 + Math.random() * 24 :       // D2–D3
    r < 0.80 ? 96 + Math.random() * 72 :       // D4–D7
               24 + Math.random() * 24         // occasional next day
  p.nextVisitAt = Date.now() + Math.floor(hours * 3600 * 1000)
}

async function visit(p: Persona) {
  const stateFile = statePath(p.id)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    userAgent: p.ua,
    locale: p.locale,
    storageState: fs.existsSync(stateFile) ? stateFile : undefined,
  })
  const page = await context.newPage()

  const url = new URL(SITE)
  url.searchParams.set('utm_source', ['organic','referral','partner','newsletter'][Math.floor(Math.random()*4)])
  url.searchParams.set('synthetic', '1') // frontend will register { synthetic: true }
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load')

  // basic browse (never open /demos)
  await page.waitForTimeout(800 + Math.random()*1800)
  await page.click('text=Popular').catch(()=>{})
  await page.waitForTimeout(500 + Math.random()*1200)
  // optional: randomly click a non-demo card if you have selectors
  // await page.locator('[data-non-demo-card]').first().click().catch(()=>{})
  // maybe play a generic video a bit (if available)
  await page.evaluate(async () => {
    const v = document.querySelector('video') as HTMLVideoElement | null
    if (v) { try { await v.play() } catch(_) {} }
  })
  await page.waitForTimeout(20000 + Math.random()*90000)

  await context.storageState({ path: stateFile })
  await browser.close()
}

;(async () => {
  ensure()
  const personas = load()
  const due = personas.filter(p => p.nextVisitAt <= Date.now()).slice(0, 25)
  for (const p of due) { await visit(p); scheduleNext(p) }
  save(personas)
})().catch((e) => { console.error(e); process.exit(1) })
