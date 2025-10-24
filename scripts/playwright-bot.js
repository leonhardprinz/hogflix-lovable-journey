// Node >= 18, ESM
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

function loadPersonas() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    throw new Error('Missing personas.json. Run scripts/synthetic-traffic.js once first.')
  }
  const arr = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
  // keep compatibility for older states
  const withSources = arr.map((p, i) => ({
    ...p,
    source: p.source || ['direct', 'newsletter', 'linkedin'][i % 3],
  }))
  return withSources
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  // Use a small random subset to keep load light and feel “returning”
  const personas = loadPersonas()
  const sample = []
  while (sample.length < Math.min(25, personas.length)) {
    const i = Math.floor(Math.random() * personas.length)
    if (!sample.includes(personas[i])) sample.push(personas[i])
  }

  for (const p of sample) {
    // Reuse the same distinct_id the server uses
    await page.addInitScript(({ id }) => {
      try {
        localStorage.setItem('posthog_distinct_id', JSON.stringify({ distinct_id: id }))
      } catch {}
    }, { id: p.distinct_id })

    // Navigate with UTMs so $utm_* are captured client-side too
    const u = `${APP_URL}/browse?utm_source=${encodeURIComponent(p.source)}&utm_medium=synthetic&utm_campaign=hogflix-bot`
    await page.goto(u, { waitUntil: 'domcontentloaded' })

    // Align person props on client (also helpful for person-level breakdowns)
    await page.evaluate(({ id, plan, source }) => {
      window.posthog?.identify?.(id, {
        plan, company_plan: plan, acq_source: source, is_synthetic: true,
        $initial_utm_source: source, $initial_utm_medium: 'synthetic', $initial_utm_campaign: 'hogflix-bot',
      })
    }, { id: p.distinct_id, plan: p.plan ?? p['plan'], source: p.source })

    // Fire the funnel steps client-side to guarantee data freshness
    await page.evaluate(({ plan, source, vid }) => {
      const base = {
        plan, company_plan: plan, is_synthetic: true,
        source, $utm_source: source, $utm_medium: 'synthetic', $utm_campaign: 'hogflix-bot',
      }
      window.posthog?.capture?.('section_clicked', { ...base, section: 'Popular' })
      window.posthog?.capture?.('title_opened',   { ...base, title_id: vid })
      window.posthog?.capture?.('video_started',  { ...base, video_id: vid })
      // 50% chance we mark progress >=50 to make the funnel look realistic
      if (Math.random() < 0.5) {
        window.posthog?.capture?.('video_progress', { ...base, video_id: vid, milestone: 50 })
      }
    }, { plan: p.plan ?? p['plan'], source: p.source, vid: '6f4d68aa-3d28-43eb-a16d-31848741832b' })

    await page.waitForTimeout(200) // small pause
  }

  await browser.close()
})()
