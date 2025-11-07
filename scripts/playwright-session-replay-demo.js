// Session Replay Demo - Complete User Journey for PostHog Visibility
// This script simulates ONE realistic user journey optimized for session replay viewing

import { chromium } from 'playwright'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const DEBUG = process.env.DEBUG === 'true'

// Helper to log each step clearly
const log = (step, detail = '') => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  console.log(`[${timestamp}] ${step}${detail ? ` - ${detail}` : ''}`)
}

async function runSessionReplayDemo() {
  log('🎬 Starting session replay demo...')
  
  const browser = await chromium.launch({
    headless: !DEBUG,
    slowMo: DEBUG ? 1000 : 0, // Slow down in debug mode
    args: ['--window-size=1920,1080']
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  const page = await context.newPage()

  // Monitor console errors
  page.on('console', msg => {
    if (DEBUG && (msg.type() === 'error' || msg.type() === 'warning')) {
      console.log(`  [BROWSER ${msg.type().toUpperCase()}]: ${msg.text()}`)
    }
  })

  try {
    // STEP 1: Landing Page with synthetic marker
    log('📍 Step 1: Landing on homepage', '?synthetic=1')
    await page.goto(`${APP_URL}/?synthetic=1`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(3000)
    log('✓ Homepage loaded')

    // STEP 2: Navigate to Signup
    log('📍 Step 2: Going to signup')
    const timestamp = Date.now()
    const email = `session-replay-${timestamp}@hogflix-synthetic.test`
    const password = 'TestPass123!'
    
    // Hover over login/signup area first
    try {
      const loginButton = await page.locator('a[href="/login"], button:has-text("Sign In"), button:has-text("Login")').first()
      if (await loginButton.count() > 0) {
        await loginButton.hover()
        await page.waitForTimeout(1000)
      }
    } catch (e) {
      log('  Note: Login button not found, going directly to signup')
    }

    await page.goto(`${APP_URL}/signup?synthetic=1`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
    log('✓ On signup page')

    // STEP 3: Fill Registration Form (slow, realistic typing)
    log('📍 Step 3: Filling registration form', email)
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    
    const emailInput = page.locator('input[type="email"]')
    await emailInput.hover()
    await page.waitForTimeout(500)
    await emailInput.fill(email, { delay: 100 }) // Type character by character
    await page.waitForTimeout(800)
    
    const passwordInput = page.locator('input[type="password"]').first()
    await passwordInput.hover()
    await page.waitForTimeout(500)
    await passwordInput.fill(password, { delay: 100 })
    await page.waitForTimeout(800)
    log('✓ Form filled')

    // STEP 4: Submit Registration
    log('📍 Step 4: Submitting registration')
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.hover()
    await page.waitForTimeout(1000)
    await submitButton.click()
    await page.waitForTimeout(5000) // Wait for signup to complete
    log('✓ Registration submitted', `User: ${email}`)

    // STEP 5: Navigate to Browse/Home to watch first movie
    log('📍 Step 5: Browsing content')
    await page.goto(`${APP_URL}/?synthetic=1`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
    
    // Find and click first movie/video card
    try {
      const videoCards = page.locator('[data-testid*="video"], [data-testid*="movie"], .cursor-pointer img[alt*="thumbnail"], a[href*="/demo/"]').first()
      if (await videoCards.count() > 0) {
        await videoCards.hover()
        await page.waitForTimeout(1500)
        await videoCards.click()
        await page.waitForTimeout(3000)
        log('✓ Opened first video')

        // STEP 6: Play the video
        log('📍 Step 6: Watching first movie (30s)')
        const playButton = page.locator('button[aria-label="Play"], button:has-text("Play"), .play-button').first()
        if (await playButton.count() > 0) {
          await playButton.hover()
          await page.waitForTimeout(1000)
          await playButton.click()
          await page.waitForTimeout(30000) // Watch for 30 seconds
          log('✓ Watched 30 seconds of video')
        }
      }
    } catch (e) {
      log('  Note: Could not play video', e.message)
    }

    // STEP 7: Visit Pricing Page
    log('📍 Step 7: Visiting pricing page')
    await page.goto(`${APP_URL}/pricing?synthetic=1`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(3000)
    
    // Scroll through pricing cards
    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(2000)
    log('✓ Reviewed pricing options')

    // STEP 8: Select Premium Plan
    log('📍 Step 8: Selecting Premium plan')
    const premiumButton = page.locator('button:has-text("Premium"), button:has-text("$19.99"), button:has-text("4K")').first()
    if (await premiumButton.count() > 0) {
      await premiumButton.scrollIntoViewIfNeeded()
      await premiumButton.hover()
      await page.waitForTimeout(2000)
      await premiumButton.click()
      await page.waitForTimeout(4000)
      log('✓ Premium plan selected')
    } else {
      // Try clicking any "Get Started" or "Choose" button in premium section
      const allButtons = await page.locator('button').all()
      for (const button of allButtons) {
        const text = await button.textContent()
        if (text && (text.includes('Preview') || text.includes('Upgrade') || text.includes('Premium'))) {
          await button.scrollIntoViewIfNeeded()
          await button.hover()
          await page.waitForTimeout(2000)
          await button.click()
          await page.waitForTimeout(4000)
          log('✓ Plan button clicked')
          break
        }
      }
    }

    // STEP 9: Complete Stripe Checkout
    log('📍 Step 9: Completing checkout with test card')
    const currentUrl = page.url()
    
    if (currentUrl.includes('/checkout')) {
      log('  On checkout page')
      await page.waitForTimeout(3000)

      // Look for demo payment methods first (HedgePal, AppleHog)
      const demoPaymentButtons = page.locator('button:has-text("HedgePal"), button:has-text("AppleHog")')
      if (await demoPaymentButtons.count() > 0) {
        log('  Using demo payment method')
        const demoButton = demoPaymentButtons.first()
        await demoButton.hover()
        await page.waitForTimeout(1500)
        await demoButton.click()
        await page.waitForTimeout(5000)
        log('✓ Demo payment completed')
      } else {
        // Try Stripe test card if available
        log('  Attempting Stripe checkout')
        try {
          // Wait for Stripe elements to load
          await page.waitForTimeout(3000)
          
          // Look for Stripe iframe
          const frames = page.frames()
          const stripeFrame = frames.find(f => f.url().includes('stripe'))
          
          if (stripeFrame) {
            log('  Filling Stripe test card')
            await stripeFrame.fill('[placeholder*="Card number"]', '4242424242424242')
            await page.waitForTimeout(500)
            await stripeFrame.fill('[placeholder*="MM"]', '1234')
            await page.waitForTimeout(500)
            await stripeFrame.fill('[placeholder*="CVC"]', '123')
            await page.waitForTimeout(500)
            await stripeFrame.fill('[placeholder*="ZIP"]', '12345')
            await page.waitForTimeout(1000)
            
            // Submit payment
            const submitPayment = page.locator('button[type="submit"]:has-text("Complete"), button:has-text("Pay"), button:has-text("Subscribe")')
            if (await submitPayment.count() > 0) {
              await submitPayment.first().click()
              await page.waitForTimeout(5000)
              log('✓ Stripe payment submitted')
            }
          } else {
            log('  No Stripe iframe found')
          }
        } catch (e) {
          log('  Stripe checkout failed', e.message)
        }
      }
    } else {
      log('  Not on checkout page, may have been redirected')
    }

    // STEP 10: Return to browse and watch second movie
    log('📍 Step 10: Watching second movie')
    await page.goto(`${APP_URL}/?synthetic=1`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
    
    try {
      // Find a different video (second one if available)
      const videoCards = page.locator('[data-testid*="video"], [data-testid*="movie"], .cursor-pointer img[alt*="thumbnail"], a[href*="/demo/"]')
      const videoCount = await videoCards.count()
      
      if (videoCount > 1) {
        await videoCards.nth(1).hover()
        await page.waitForTimeout(1500)
        await videoCards.nth(1).click()
        await page.waitForTimeout(3000)
        log('✓ Opened second video')

        const playButton = page.locator('button[aria-label="Play"], button:has-text("Play"), .play-button').first()
        if (await playButton.count() > 0) {
          await playButton.hover()
          await page.waitForTimeout(1000)
          await playButton.click()
          await page.waitForTimeout(30000) // Watch for 30 seconds
          log('✓ Watched 30 seconds of second video')
        }
      } else if (videoCount > 0) {
        // Just watch first video again
        await videoCards.first().hover()
        await page.waitForTimeout(1500)
        await videoCards.first().click()
        await page.waitForTimeout(3000)
        
        const playButton = page.locator('button[aria-label="Play"], button:has-text("Play"), .play-button').first()
        if (await playButton.count() > 0) {
          await playButton.hover()
          await page.waitForTimeout(1000)
          await playButton.click()
          await page.waitForTimeout(30000)
          log('✓ Watched video')
        }
      }
    } catch (e) {
      log('  Note: Could not play second video', e.message)
    }

    log('🎉 Session replay demo completed successfully!')
    log('📹 Check PostHog Session Replay for this session')
    log(`   Filter by: is_synthetic = true OR email contains "${email}"`)

  } catch (error) {
    log('❌ Session replay demo failed', error.message)
    if (DEBUG) {
      console.error('Full error:', error)
      await page.screenshot({ path: `./session_replay_error_${Date.now()}.png` })
      log('📸 Screenshot saved for debugging')
    }
    throw error
  } finally {
    await browser.close()
  }
}

// Execute
if (import.meta.url === `file://${process.argv[1]}`) {
  runSessionReplayDemo()
    .then(() => {
      console.log('\n✅ Script completed successfully')
      process.exit(0)
    })
    .catch(err => {
      console.error('\n❌ Script failed:', err.message)
      process.exit(1)
    })
}

export { runSessionReplayDemo }
