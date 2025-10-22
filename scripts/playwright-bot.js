// Node >= 18, ESM
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

function pickSourceByIndex(i) {
  const r = i % 100
  if (r < 40) return 'direct'
  if (r < 70) return 'newsletter'
  if (r < 95) return 'linkedin'
  if (r < 97) return 'organic'
  if (r < 99) return 'partner'
  return 'referral'
}

function loadPersonas() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    throw new Error('Missing personas.json. Run scripts/synthetic-traffic.js once to create it.')
  }
  const personas = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
  // enrich if older file lacks source
  personas.forEach((p, idx) => { if (!p.source) p.source = pickSourceByIndex(idx) })
  return personas
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const personas = loadPersonas()
  const slice = personas.slice(0, 40) // small returning subset

  for (const p of slice) {
    // Force web SDK to reuse server distinct_id
    await page.addInitScript(({ id }) => {
      try {
        localStorage.setItem('posthog_distinct_id', JSON.stringify({ distinct_id: id }))
      } catch {}
    }, { id: p.distinct_id })

    // Navigate with UTMs so PostHog auto-captures $utm_* on pageview
    const url = `${APP_URL}/browse?utm_source=${encodeURIComponent(p.source)}&utm_medium=synthetic&utm_campaign=hogflix-bot`
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    // Mirror person props on client
    await page.evaluate(({ id, plan, source }) => {
      window.posthog?.identify?.(id, { plan, acq_source: source, is_synthetic: true })
    }, { id: p.distinct_id, plan: p.plan, source: p.source })

    // Emit a browser-side title_opened with UTMs too (so breakdown definitely works)
    await page.evaluate(({ plan, source }) => {
      window.posthog?.capture?.('title_opened', {
        plan,
        is_synthetic: true,
        source,
        $utm_source: source,
        $utm_medium: 'synthetic',
        $utm_campaign: 'hogflix-bot',
      })
    }, { plan: p.plan, source: p.source })

    // Small interaction to generate more activity
    await page.waitForTimeout(400)
    await page.mouse.click(300, 500)
    await page.waitForTimeout(400)
  }

  await browser.close()
})()
