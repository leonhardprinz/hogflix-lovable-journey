import { chromium, devices } from 'playwright'
import { randomUUID } from 'crypto'

const personas = [
  { persona: 'binge_watcher', device: devices['Desktop Chrome'] },
  { persona: 'casual_mobile', device: devices['iPhone 13'] },
  { persona: 'searcher',      device: devices['Desktop Chrome'] },
]

const companies = [
  { id: 'acme-001', name: 'Acme Corp',      plan: 'Premium' },
  { id: 'globex-002', name: 'Globex GmbH',  plan: 'Standard' },
  { id: 'initech-003', name: 'Initech d.o.o.', plan: 'Basic' },
]

const utms = [
  { utm_source: 'linkedin', utm_medium: 'paid',  utm_campaign: 'hogflix_launch' },
  { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'q4_updates' },
  { utm_source: 'direct', utm_medium: 'none',  utm_campaign: 'none' },
]

const pick = (xs) => xs[Math.floor(Math.random()*xs.length)]

async function runOnce() {
  const p = pick(personas)
  const c = pick(companies)
  const u = pick(utms)
  const distinctId = `syn_${p.persona}_${randomUUID().slice(0,8)}`

  const browser = await chromium.launch()
  const context = await browser.newContext({ ...p.device })
  const page = await context.newPage()

  // Land with UTM params
  await page.goto(`https://hogflix-demo.lovable.app/?utm_source=${u.utm_source}&utm_medium=${u.utm_medium}&utm_campaign=${u.utm_campaign}`, { waitUntil: 'domcontentloaded' })

  // Identify + person properties in browser (so recordings carry them)
  await page.evaluate(
    ({ id, persona, company, u }) => {
      const setProps = () => {
        const ph = window.posthog
        if (!ph) return
        try {
          ph.identify(id, {
            persona,
            device_type: /iPhone|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            company_id: company.id,
            company_name: company.name,
            company_plan: company.plan, // Basic | Standard | Premium
            utm_source: u.utm_source,
            utm_medium: u.utm_medium,
            utm_campaign: u.utm_campaign,
            source: 'hogflix-bot',
            is_synthetic: true,
          })
        } catch {}
      }
      if (document.readyState === 'complete') setProps()
      else window.addEventListener('load', setProps)
    },
    { id: distinctId, persona: p.persona, company: c, u }
  )

  // Browse around
  await page.waitForTimeout(800 + Math.random()*800)
  await page.getByRole('link', { name: /Popular/i }).click().catch(()=>{})
  await page.waitForTimeout(600 + Math.random()*600)

  const sels = ['[data-test*="title"]','[data-test*="card"]','a[href*="/title"]','.card a','a:has-text("Play")']
  for (const sel of sels) {
    const count = await page.locator(sel).count()
    if (count > 0) {
      for (let i=0; i<Math.min(3,count); i++) {
        await page.locator(sel).nth(i).click().catch(()=>{})
        await page.waitForTimeout(500 + Math.random()*700)
        await page.keyboard.press('Space').catch(()=>{})
        await page.waitForTimeout(1000 + Math.random()*1500)
        await page.goBack().catch(()=>{})
      }
      break
    }
  }

  await page.getByRole('link', { name: /Trending/i }).click().catch(()=>{})
  await page.waitForTimeout(500 + Math.random()*600)

  await context.storageState({ path: 'state.json' })
  await browser.close()
}

runOnce().catch((e)=>{ console.error(e); process.exit(1) })
