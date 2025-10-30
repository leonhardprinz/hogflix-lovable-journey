// LEGACY: Lightweight Playwright bot for basic funnel events
// NEW: Use playwright-journey-new-user.js and playwright-journey-returning-user.js instead
// This script remains for backward compatibility and quick smoke tests

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

function loadPersonas() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    console.log('Missing personas.json. Run scripts/synthetic-traffic.js first.')
    return []
  }
  const arr = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
  const withSources = arr.map((p, i) => ({
    ...p,
    source: p.source || ['direct', 'newsletter', 'linkedin'][i % 3],
  }))
  return withSources
}

;(async () => {
  console.log('[LEGACY BOT] Running lightweight funnel events...')
  
  const personas = loadPersonas()
  if (personas.length === 0) {
    console.log('No personas available. Exiting.')
    return
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Small random subset
  const sample = []
  const sampleSize = Math.min(15, personas.length)
  while (sample.length < sampleSize) {
    const i = Math.floor(Math.random() * personas.length)
    if (!sample.find(s => s.distinct_id === personas[i].distinct_id)) {
      sample.push(personas[i])
    }
  }

  console.log(`Selected ${sample.length} personas for quick funnel events`)

  for (let i = 0; i < sample.length; i++) {
    const p = sample[i]
    console.log(`  [${i + 1}/${sample.length}] ${p.email || p.distinct_id}`)

    await page.addInitScript(({ id }) => {
      try {
        localStorage.setItem('posthog_distinct_id', JSON.stringify({ distinct_id: id }))
      } catch {}
    }, { id: p.distinct_id })

    const u = `${APP_URL}/browse?utm_source=${encodeURIComponent(p.source || 'direct')}&utm_medium=synthetic&utm_campaign=hogflix-bot`
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(500)

    await page.evaluate(({ id, plan, source, device, browser }) => {
      window.posthog?.identify?.(id, {
        plan, 
        is_synthetic: true,
        source,
        device_type: device || 'Desktop',
        browser: browser || 'Chrome',
        $initial_utm_source: source, 
        $initial_utm_medium: 'synthetic', 
        $initial_utm_campaign: 'hogflix-bot',
      })

      const base = { plan, is_synthetic: true, source, device_type: device || 'Desktop' }
      window.posthog?.capture?.('section_clicked', { ...base, section: 'Popular' })
      window.posthog?.capture?.('title_opened', { ...base, title_id: '6f4d68aa-3d28-43eb-a16d-31848741832b' })
      window.posthog?.capture?.('video_started', { ...base, video_id: '6f4d68aa-3d28-43eb-a16d-31848741832b' })
      
      if (Math.random() < 0.5) {
        window.posthog?.capture?.('video_progress', { ...base, video_id: '6f4d68aa-3d28-43eb-a16d-31848741832b', milestone: 50 })
      }
    }, { id: p.distinct_id, plan: p.plan, source: p.source || 'direct', device: p.device_type, browser: p.browser })

    await page.waitForTimeout(200)
  }

  await browser.close()
  console.log('[LEGACY BOT] Completed\n')
})()
