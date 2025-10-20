// Node >= 18, ESM
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

function loadPersonas() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    throw new Error('Missing personas.json. Run scripts/synthetic-traffic.js once to create it.')
  }
  return JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const personas = loadPersonas()
  const slice = personas.slice(0, 40) // small, returning subset

  for (const p of slice) {
    // Force web SDK to reuse server distinct_id
    await page.addInitScript(({ id }) => {
      try {
        localStorage.setItem('posthog_distinct_id', JSON.stringify({ distinct_id: id }))
      } catch {}
    }, { id: p.distinct_id })

    await page.goto(`${APP_URL}/browse`, { waitUntil: 'domcontentloaded' })

    // Align person props on the client too (harmless if already set server-side)
    await page.evaluate(({ id, plan }) => {
      window.posthog?.identify?.(id, { plan, is_synthetic: true })
    }, { id: p.distinct_id, plan: p.plan })

    // Tiny interaction to generate client events
    await page.waitForTimeout(500)
    await page.mouse.click(300, 500)
    await page.waitForTimeout(800)
  }

  await browser.close()
})()
