// New User Signup Journey - Full funnel from landing to conversion
import { chromium } from 'playwright'
import { PostHog } from 'posthog-node'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const DEBUG = process.env.DEBUG === 'true'

// Initialize PostHog for server-side event capture
const posthog = new PostHog(
  process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
  { host: 'https://eu.i.posthog.com' }
)

// Device profiles for realistic diversity
const DEVICES = [
  { type: 'Desktop', browser: 'Chrome', os: 'Windows', width: 1920, height: 1080, weight: 40 },
  { type: 'Desktop', browser: 'Safari', os: 'macOS', width: 1440, height: 900, weight: 20 },
  { type: 'Desktop', browser: 'Firefox', os: 'Windows', width: 1366, height: 768, weight: 15 },
  { type: 'Mobile', browser: 'Safari', os: 'iOS', width: 375, height: 812, weight: 15 },
  { type: 'Mobile', browser: 'Chrome', os: 'Android', width: 414, height: 896, weight: 10 }
]

// Acquisition source distribution
const ACQUISITION_SOURCES = [
  { source: 'google', medium: 'organic', weight: 30 },
  { source: 'facebook', medium: 'social', weight: 15 },
  { source: 'twitter', medium: 'social', weight: 10 },
  { source: 'google_ads', medium: 'cpc', weight: 15 },
  { source: 'newsletter', medium: 'email', weight: 15 },
  { source: 'reddit', medium: 'social', weight: 5 },
  { source: 'direct', medium: 'none', weight: 10 }
]

// Subscription plans
const PLANS = [
  { id: 'basic', weight: 60 },
  { id: 'standard', weight: 30 },
  { id: 'premium', weight: 10 }
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

const FIRST_NAMES = ['john', 'jane', 'alex', 'sarah', 'michael', 'emma', 'david', 'olivia', 'james', 'sophia', 'william', 'ava', 'robert', 'isabella', 'chris', 'mia', 'daniel', 'charlotte', 'matthew', 'amelia']
const LAST_NAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor', 'moore', 'jackson', 'martin']
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com']

function generateEmail() {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  const number = Math.floor(Math.random() * 9999)
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)]
  
  return `${firstName}.${lastName}${number}@${domain}`
}

function generatePassword() {
  return `SynTest${Math.floor(Math.random() * 100000)}!`
}

async function simulateNewUserJourney(count = 10) {
  const browser = await chromium.launch({ headless: true })
  const journeys = []

  for (let i = 0; i < count; i++) {
    const device = weightedChoice(DEVICES)
    const acquisition = weightedChoice(ACQUISITION_SOURCES)
    const plan = weightedChoice(PLANS)
    const email = generateEmail()
    const password = generatePassword()

    console.log(`[NEW USER ${i + 1}/${count}] Starting journey - ${device.type} ${device.browser} from ${acquisition.source}`)

    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      userAgent: device.browser === 'Safari' 
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        : device.browser === 'Firefox'
        ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    const page = await context.newPage()
    
    // Monitor console errors in debug mode
    page.on('console', msg => {
      if (DEBUG && (msg.type() === 'error' || msg.type() === 'warning')) {
        console.log(`  [BROWSER ${msg.type().toUpperCase()}]:`, msg.text())
      }
    })

    try {
      // Step 1: Landing page with UTM parameters
      const landingUrl = `${APP_URL}/?utm_source=${encodeURIComponent(acquisition.source)}&utm_medium=${encodeURIComponent(acquisition.medium)}&utm_campaign=hogflix-dynamic`
      await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1000 + Math.random() * 2000)

      if (DEBUG) {
        console.log(`  [DEBUG] Landing page loaded: ${page.url()}`)
      }

      // Capture page view (server-side)
      posthog.capture({
        distinctId: email,
        event: '$pageview',
        properties: {
          $current_url: landingUrl,
          $browser: device.browser,
          $device_type: device.type,
          $os: device.os,
          $screen_width: device.width,
          $screen_height: device.height,
          utm_source: acquisition.source,
          utm_medium: acquisition.medium,
          utm_campaign: 'hogflix-dynamic',
          is_synthetic: true
        }
      })

      // Step 2: Navigate to pricing page (75% chance)
      if (Math.random() < 0.75) {
        console.log(`  → Visiting pricing page`)
        await page.goto(`${APP_URL}/pricing?utm_source=${acquisition.source}&utm_medium=${acquisition.medium}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(2000 + Math.random() * 3000)

        // Capture pricing view (server-side)
        posthog.capture({
          distinctId: email,
          event: 'pricing_page_viewed',
          properties: {
            plan_interest: plan.id,
            device_type: device.type,
            $browser: device.browser,
            $device_type: device.type,
            $os: device.os,
            $current_url: `${APP_URL}/pricing`,
            is_synthetic: true
          }
        })

        // Try to click a plan button (if exists)
        try {
          const planButtons = await page.$$(`button:has-text("Choose"), a:has-text("Get Started")`)
          if (planButtons.length > 0) {
            const randomButton = planButtons[Math.floor(Math.random() * planButtons.length)]
            await randomButton.click()
            await page.waitForTimeout(1000)
          }
        } catch (e) {
          if (DEBUG) console.log(`  [DEBUG] Button not found:`, e.message)
        }
      }

      // Step 3: Navigate to signup
      console.log(`  → Going to signup`)
      await page.goto(`${APP_URL}/signup?plan=${plan.id}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1500)

      // Step 4: Fill signup form
      console.log(`  → Filling signup form (${email})`)
      
      // Wait for form elements
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      
      // Type email
      await page.fill('input[type="email"]', email)
      await page.waitForTimeout(300 + Math.random() * 700)
      
      // Type password
      await page.fill('input[type="password"]', password)
      await page.waitForTimeout(300 + Math.random() * 700)

      // Check newsletter opt-in (50% chance)
      if (Math.random() < 0.5) {
        try {
          await page.check('input[type="checkbox"]')
        } catch (e) {
          // Checkbox not found
        }
      }

      // Capture form filled event (server-side)
      posthog.capture({
        distinctId: email,
        event: 'signup_form_filled',
        properties: {
          plan: plan.id,
          device_type: device.type,
          source: acquisition.source,
          $browser: device.browser,
          $device_type: device.type,
          $os: device.os,
          is_synthetic: true
        }
      })

      // Step 5: Submit form
      console.log(`  → Submitting signup`)
      await page.click('button[type="submit"]')
      
      // Wait for navigation or error
      await page.waitForTimeout(3000)

      // Check if signup was successful (look for redirect or success message)
      const currentUrl = page.url()
      const signupFailed = currentUrl.includes('/signup')
      const signupSuccess = currentUrl.includes('/profiles') || 
                            currentUrl.includes('/checkout') || 
                            currentUrl.includes('/browse')
      
      console.log(`  → After signup: ${currentUrl}`)

      if (signupFailed) {
        // Check for error messages on page
        const errorText = await page.textContent('body').catch(() => '')
        console.log(`  ❌ Signup failed for ${email}`)
        
        // Look for specific auth errors
        const authError = await page.locator('[role="alert"], .error-message, .text-red-500, .text-destructive')
          .first()
          .textContent()
          .catch(() => null)
        
        if (authError) {
          console.log(`  ❌ Auth error: ${authError}`)
        } else if (errorText.length > 0) {
          console.log(`  ❌ Page error (first 200 chars): ${errorText.substring(0, 200)}`)
        }
        
        // Take screenshot in debug mode
        if (DEBUG) {
          const screenshotPath = `./debug_signup_fail_${Date.now()}.png`
          await page.screenshot({ path: screenshotPath })
          console.log(`  📸 Screenshot saved: ${screenshotPath}`)
        }
        
        await context.close()
        continue // Skip to next user
      }

      if (signupSuccess) {
        console.log(`  ✓ Signup successful`)
        
        // Capture signup success (server-side)
        posthog.capture({
          distinctId: email,
          event: 'signup_completed',
          properties: {
            email: email,
            plan: plan.id,
            device_type: device.type,
            source: acquisition.source,
            $browser: device.browser,
            $device_type: device.type,
            $os: device.os,
            $screen_width: device.width,
            $screen_height: device.height,
            $initial_utm_source: acquisition.source,
            $initial_utm_medium: acquisition.medium,
            $initial_utm_campaign: 'hogflix-dynamic',
            is_synthetic: true
          }
        })
        
        // Set person properties (server-side)
        posthog.identify({
          distinctId: email,
          properties: {
            email: email,
            plan: plan.id,
            device_type: device.type,
            browser: device.browser,
            os: device.os,
            $initial_utm_source: acquisition.source,
            $initial_utm_medium: acquisition.medium,
            $initial_utm_campaign: 'hogflix-dynamic',
            is_synthetic: true
          }
        })

        // Step 6: If on checkout page, simulate Stripe flow (paid plans)
        if (currentUrl.includes('/checkout') && plan.id !== 'basic') {
          console.log(`  → Starting checkout flow`)
          await page.waitForTimeout(2000)

          // Capture checkout started (server-side)
          posthog.capture({
            distinctId: email,
            event: 'checkout_started',
            properties: {
              plan: plan.id,
              $browser: device.browser,
              $device_type: device.type,
              is_synthetic: true
            }
          })

          // Try to interact with checkout (if demo Stripe or payment buttons exist)
          try {
            // Look for Stripe or payment button
            const paymentButtons = await page.$$('button:has-text("Pay"), button:has-text("Subscribe"), button:has-text("Complete")')
            if (paymentButtons.length > 0) {
              console.log(`  → Clicking payment button`)
              await paymentButtons[0].click()
              await page.waitForTimeout(2000)

              // Capture checkout completed (server-side)
              posthog.capture({
                distinctId: email,
                event: 'checkout_completed',
                properties: {
                  plan: plan.id,
                  payment_method: 'test_card',
                  $browser: device.browser,
                  $device_type: device.type,
                  is_synthetic: true
                }
              })
            }
          } catch (e) {
            console.log(`  ! Checkout interaction failed:`, e.message)
          }
        }

        // Step 7: Browse a bit after signup
        await page.goto(`${APP_URL}/browse`, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(1000 + Math.random() * 2000)

        journeys.push({
          email,
          plan: plan.id,
          device: device.type,
          browser: device.browser,
          os: device.os,
          source: acquisition.source,
          medium: acquisition.medium,
          success: true
        })
      } else {
        console.log(`  ! Signup may have failed or is pending verification`)
        journeys.push({ email, success: false })
      }

    } catch (error) {
      console.error(`  ! Error in journey ${i + 1}:`, error.message)
      if (DEBUG) {
        console.error(`  [DEBUG] Full error:`, error)
        await page.screenshot({ path: `./error_${Date.now()}.png` }).catch(() => {})
      }
      journeys.push({ email, success: false, error: error.message })
    } finally {
      await context.close()
    }

    // Small delay between journeys
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
  }

  await browser.close()
  
  const successful = journeys.filter(j => j.success).length
  console.log(`\n[SUMMARY] ${successful}/${count} new user journeys completed successfully`)
  
  return journeys
}

// Main execution
;(async () => {
  const count = parseInt(process.env.NEW_USER_COUNT || '10', 10)
  console.log(`Starting ${count} new user signup journeys...\n`)
  
  try {
    const results = await simulateNewUserJourney(count)
    console.log(`\nAll journeys completed. Flushing PostHog events...`)
    
    // Ensure all events are sent to PostHog
    await posthog.shutdown()
    console.log(`✓ PostHog events flushed. Check PostHog for signup funnel data.`)
  } catch (error) {
    console.error('Fatal error:', error)
    await posthog.shutdown()
    process.exit(1)
  }
})()
