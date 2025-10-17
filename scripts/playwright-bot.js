// scripts/playwright-bot.js
// Purpose: legacy single-run bot. Keeps compatibility but now marks sessions synthetic
// and avoids the Demo area entirely.

const { chromium } = require('playwright')

async function runBot(user) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const site = process.env.HOGFLIX_URL || 'https://hogflix-demo.lovable.app/'
  const url = new URL(site)
  url.searchParams.set('synthetic', '1')
  url.searchParams.set('utm_source', user.utm_source || 'bot')
  url.searchParams.set('utm_medium', user.utm_medium || 'script')
  url.searchParams.set('utm_campaign', user.utm_campaign || 'legacy')

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('load')

  await page.evaluate((distinctId) => {
    function setProps() {
      const ph = window.posthog
      if (!ph) return
      // person identify + flags
      if (distinctId) {
        ph.identify(distinctId, { is_synthetic: true, source: 'playwright-bot' })
      }
      // session super-props
      ph.register({ synthetic: true, is_synthetic: true, source: 'playwright-bot' })
    }
    if (document.readyState === 'complete') setProps()
    else window.addEventListener('load', setProps)
  }, user.distinct_id || null)

  // Click some non-demo links
  const anchors = await page.$$eval('a[href]', (els) =>
    els.map((a) => a.href).filter((h) => !!h && !h.includes('/demos') && !/\/demo(s)?\b/i.test(h))
  )
  const subset = anchors.sort(() => 0.5 - Math.random()).slice(0, 3)
  for (const href of subset) {
    try {
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForTimeout(1000 + Math.random() * 2000)
    } catch {}
  }

  await browser.close()
}

if (require.main === module) {
  const user = {
    distinct_id: `legacy-${Math.floor(Math.random() * 1e9)}`,
    utm_source: 'legacy',
    utm_medium: 'script',
    utm_campaign: 'compat',
  }
  runBot(user).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

module.exports = { runBot }
