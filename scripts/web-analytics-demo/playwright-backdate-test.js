/**
 * Test: can we backdate Playwright sessions by spoofing Date in the browser?
 *
 * The idea: PostHog's session-consumer pulls $start_timestamp from event timestamps.
 * posthog-js reads Date.now() to stamp its events. If we override Date in the browser
 * context BEFORE posthog-js loads, we can fake a historical session.
 *
 * Unknown: whether PostHog's session-consumer accepts events with timestamps far in
 * the past, or whether it uses ingestion time and ignores backdated timestamps.
 *
 * This script sends 1 session backdated 5 days into the past. Then we check the
 * sessions table to see what $start_timestamp it got.
 */

import { chromium as rawChromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

rawChromium.use(StealthPlugin())
const chromium = rawChromium

const APP_URL = 'https://hogflix-project.vercel.app'
const BACKDATE_DAYS = parseInt(process.argv[2] || '5', 10)

async function main() {
  const offsetMs = BACKDATE_DAYS * 86400_000
  const fakeNowMs = Date.now() - offsetMs
  const tagId = `backdate-test-${Date.now()}`

  console.log(`backdate test: spoofing browser clock to ${BACKDATE_DAYS}d ago`)
  console.log(`  fake "now" in browser:  ${new Date(fakeNowMs).toISOString()}`)
  console.log(`  tag (find this event):  ${tagId}`)
  console.log('')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  })

  // Inject clock spoof BEFORE any page script runs.
  await context.addInitScript((args) => {
    const { fakeNowMs } = args
    const RealDate = Date
    const offset = fakeNowMs - RealDate.now()

    function FakeDate(...a) {
      if (a.length === 0) return new RealDate(RealDate.now() + offset)
      return new RealDate(...a)
    }
    FakeDate.now = () => RealDate.now() + offset
    FakeDate.parse = RealDate.parse
    FakeDate.UTC = RealDate.UTC
    FakeDate.prototype = RealDate.prototype
    Object.setPrototypeOf(FakeDate, RealDate)
    // @ts-ignore
    window.Date = FakeDate
  }, { fakeNowMs })

  const page = await context.newPage()
  page.on('request', req => {
    const u = req.url()
    if (u.includes('/e/') || u.includes('/i/v0/e/') || u.includes('/batch/')) {
      console.log(`  ph capture: ${req.method()} ${u.slice(0, 90)}`)
    }
  })

  // Land on /pricing with a unique tag UTM so we can find it later.
  const url = `${APP_URL}/pricing?utm_source=backdate_test&utm_campaign=${tagId}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  // Wait for posthog-js to load and fire pageview (with our spoofed timestamp)
  await page.waitForTimeout(8000)

  // Confirm Date is spoofed inside the page
  const browserNow = await page.evaluate(() => new Date().toISOString())
  console.log(`\n  browser sees Date as: ${browserNow}`)

  await page.waitForTimeout(5000)
  await context.close()
  await browser.close()
  console.log(`\ndone. wait ~30s then check PostHog:`)
  console.log(`  events table: utm_campaign = ${tagId}`)
  console.log(`  sessions table: $entry_utm_campaign = ${tagId}`)
}

main().catch(err => {
  console.error('fatal:', err)
  process.exit(1)
})
