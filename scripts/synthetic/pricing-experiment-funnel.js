// Pricing Experiment Funnel - Drives traffic through pricing → signup conversion
// This script specifically targets the pricing_page_layout_experiment
import { chromium } from 'playwright'
import { PostHog } from 'posthog-node'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const DEBUG = process.env.DEBUG === 'true'
const FUNNEL_COUNT = parseInt(process.env.PRICING_FUNNEL_COUNT || '20', 10)

// Initialize PostHog for server-side event capture
const posthog = new PostHog(
  process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
  { host: 'https://eu.i.posthog.com' }
)

// Device profiles
const DEVICES = [
  { type: 'Desktop', browser: 'Chrome', os: 'Windows', width: 1920, height: 1080, weight: 45 },
  { type: 'Desktop', browser: 'Safari', os: 'macOS', width: 1440, height: 900, weight: 25 },
  { type: 'Mobile', browser: 'Safari', os: 'iOS', width: 375, height: 812, weight: 20 },
  { type: 'Mobile', browser: 'Chrome', os: 'Android', width: 414, height: 896, weight: 10 }
]

// UTM sources for realistic traffic
const UTM_SOURCES = [
  { source: 'google', medium: 'cpc', campaign: 'pricing-test', weight: 35 },
  { source: 'facebook', medium: 'social', campaign: 'pricing-awareness', weight: 25 },
  { source: 'email', medium: 'newsletter', campaign: 'weekly-digest', weight: 20 },
  { source: 'direct', medium: 'none', campaign: 'none', weight: 20 }
]

// Plans with conversion weights
const PLANS = [
  { id: 'basic', name: 'Basic', weight: 50 },
  { id: 'standard', name: 'Standard', weight: 35 },
  { id: 'ultimate', name: 'Ultimate', weight: 15 }
]

function weightedChoice(arr) {
  const total = arr.reduce((sum, item) => sum + item.weight, 0)
  let rand = Math.random() * total
  for (const item of arr) {
    rand -= item.weight
    if (rand <= 0) return item
  }
  return arr[0]
}

// Generate realistic email
const FIRST_NAMES = ['emma', 'liam', 'olivia', 'noah', 'ava', 'william', 'sophia', 'james', 'isabella', 'oliver', 'mia', 'benjamin', 'charlotte', 'elijah', 'amelia']
const LAST_NAMES = ['anderson', 'thomas', 'jackson', 'white', 'harris', 'martin', 'thompson', 'garcia', 'martinez', 'robinson', 'clark', 'rodriguez', 'lewis', 'lee', 'walker']
const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'proton.me']

function generateEmail() {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  const number = Math.floor(Math.random() * 9999)
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)]
  return `${firstName}.${lastName}${number}@${domain}`
}

function generatePassword() {
  return `PricingTest${Math.floor(Math.random() * 100000)}!`
}

async function runPricingExperimentFunnel(count = 20) {
  const browser = await chromium.launch({ headless: true })
  const results = { exposures: 0, signups: 0, controlExposures: 0, variantExposures: 0 }

  console.log(`\n🎯 Starting ${count} pricing experiment funnel journeys...\n`)

  for (let i = 0; i < count; i++) {
    const device = weightedChoice(DEVICES)
    const utm = weightedChoice(UTM_SOURCES)
    const plan = weightedChoice(PLANS)
    const email = generateEmail()
    const password = generatePassword()
    const distinctId = `pricing-exp-${Date.now()}-${i}`

    console.log(`[${i + 1}/${count}] ${device.type} from ${utm.source} → ${plan.id} plan`)

    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      userAgent: device.browser === 'Safari'
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    const page = await context.newPage()

    try {
      // Step 1: Visit pricing page (this triggers feature flag exposure in browser)
      const pricingUrl = `${APP_URL}/pricing?synthetic=1&utm_source=${utm.source}&utm_medium=${utm.medium}&utm_campaign=${utm.campaign}`
      await page.goto(pricingUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(3000) // Wait for PostHog to capture feature flag exposure
      
      results.exposures++
      console.log(`  ✓ Pricing page loaded (feature flag exposed)`)

      // Simulate reading pricing options
      await page.waitForTimeout(2000 + Math.random() * 3000)

      // Step 2: Click on a plan (88% proceed to signup - matching experiment target)
      const proceedToSignup = Math.random() < 0.88
      
      if (proceedToSignup) {
        // Try to click the plan button
        try {
          const planSelector = plan.id === 'basic' 
            ? 'button:has-text("Get Started"), button:has-text("Choose Basic")'
            : plan.id === 'standard'
            ? 'button:has-text("Choose Standard"), button:has-text("Most Popular")'
            : 'button:has-text("Choose Ultimate"), button:has-text("Go Ultimate")'
          
          const planButton = await page.$(planSelector)
          if (planButton) {
            await planButton.click()
            await page.waitForTimeout(1500)
          }
        } catch (e) {
          if (DEBUG) console.log(`  [DEBUG] Plan button click failed: ${e.message}`)
        }

        // Step 3: Navigate to signup with plan
        console.log(`  → Navigating to signup`)
        await page.goto(`${APP_URL}/signup?synthetic=1&plan=${plan.id}`, { waitUntil: 'networkidle', timeout: 15000 })
        await page.waitForTimeout(2000)

        // Step 4: Fill and submit signup form
        console.log(`  → Filling signup form (${email})`)
        
        await page.waitForSelector('input[type="email"]', { timeout: 10000 })
        await page.fill('input[type="email"]', email)
        await page.waitForTimeout(300 + Math.random() * 500)
        
        await page.fill('input[type="password"]', password)
        await page.waitForTimeout(300 + Math.random() * 500)

        // Newsletter opt-in (60% opt in)
        if (Math.random() < 0.6) {
          try {
            await page.check('input[type="checkbox"]')
          } catch (e) {}
        }

        // Submit form
        console.log(`  → Submitting signup`)
        await page.click('button[type="submit"]')
        await page.waitForTimeout(4000)

        // Check result
        const currentUrl = page.url()
        const signupSuccess = currentUrl.includes('/profiles') || 
                              currentUrl.includes('/checkout') ||
                              currentUrl.includes('/browse')

        if (signupSuccess) {
          results.signups++
          console.log(`  ✓ Signup completed successfully`)
          
          // Wait for user_signed_up event to be captured
          await page.waitForTimeout(2000)
        } else {
          console.log(`  ⚠ Signup may be pending verification`)
        }
      } else {
        console.log(`  → User bounced from pricing (no signup)`)
      }

      // Wait for PostHog to flush
      await page.waitForTimeout(3000)

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`)
      if (DEBUG) {
        await page.screenshot({ path: `./pricing_funnel_error_${Date.now()}.png` }).catch(() => {})
      }
    } finally {
      await context.close()
    }

    // Small delay between users
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000))
  }

  await browser.close()

  console.log(`\n📊 Pricing Experiment Funnel Summary:`)
  console.log(`   Exposures: ${results.exposures}`)
  console.log(`   Signups: ${results.signups}`)
  console.log(`   Conversion rate: ${((results.signups / results.exposures) * 100).toFixed(1)}%`)

  return results
}

// Main execution
;(async () => {
  console.log(`\n🎯 Pricing Experiment Funnel Script`)
  console.log(`   Target: pricing_page_layout_experiment`)
  console.log(`   Metric: user_signed_up\n`)

  try {
    const results = await runPricingExperimentFunnel(FUNNEL_COUNT)
    
    console.log(`\nFlushing PostHog events...`)
    await posthog.shutdown()
    
    console.log(`✓ Complete. Check PostHog experiment for new data.`)
  } catch (error) {
    console.error('Fatal error:', error)
    await posthog.shutdown()
    process.exit(1)
  }
})()
