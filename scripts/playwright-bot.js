import { chromium, devices } from 'playwright'

const personas = [devices['Desktop Chrome'], devices['iPhone 13']]

async function runOnce() {
  const device = personas[Math.floor(Math.random() * personas.length)]
  const browser = await chromium.launch()
  const context = await browser.newContext({ ...device })
  const page = await context.newPage()

  await page.goto('https://hogflix-demo.lovable.app/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800 + Math.random() * 800)

  // Try nav links by accessible name
  await page.getByRole('link', { name: /Popular/i }).click().catch(() => {})
  await page.waitForTimeout(600 + Math.random() * 600)

  // Click a few candidate "cards"
  const sels = [
    '[data-test*="title"]',
    '[data-test*="card"]',
    'a[href*="/title"]',
    '.card a',
    'a:has-text("Play")',
  ]
  for (const sel of sels) {
    const count = await page.locator(sel).count()
    if (count > 0) {
      for (let i = 0; i < Math.min(3, count); i++) {
        await page.locator(sel).nth(i).click().catch(() => {})
        await page.waitForTimeout(500 + Math.random() * 700)
        await page.keyboard.press('Space').catch(() => {})
        await page.waitForTimeout(1000 + Math.random() * 1500)
        await page.goBack().catch(() => {})
      }
      break
    }
  }

  await page.getByRole('link', { name: /Trending/i }).click().catch(() => {})
  await page.waitForTimeout(500 + Math.random() * 600)

  await context.storageState({ path: 'state.json' })
  await browser.close()
}

runOnce().catch((e) => { console.error(e); process.exit(1) })
