import { chromium, Page } from '@playwright/test';

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

const USER = {
    email: 'summers.nor-7f@icloud.com', 
    password: 'zug2vec5ZBE.dkq*ubk'
};

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🛠️ Force PostHog to wake up and record
 */
async function forcePostHogStart(page: Page) {
    await page.evaluate(() => {
        // @ts-ignore
        if (window.posthog) {
            // @ts-ignore
            window.posthog.debug(true);
            // @ts-ignore
            // LIE TO POSTHOG: Tell it we are a standard Desktop Chrome
            window.posthog.capture('$pageview', { $browser_type: 'desktop', $device_type: 'Desktop' }); 
            // @ts-ignore
            window.posthog.opt_in_capturing();
            // @ts-ignore
            window.posthog.startSessionRecording();
            console.log('   💉 PostHog: Forced startSessionRecording() & Opt-In');
        }
    });
}

/**
 * 🧠 Detect what page we are on
 */
async function detectState(page: Page) {
    const url = page.url();
    if (url.includes('/auth') || url.includes('/login')) return 'AUTH';
    if (url.includes('/profiles')) return 'PROFILES';
    if (url.includes('/watch')) return 'WATCHING';
    
    // UI Checks
    if (await page.locator('input[type="password"]').count() > 0) return 'AUTH';
    if (await page.locator('text=Who’s Watching?').count() > 0) return 'PROFILES';
    
    const dashboardSignals = page.locator('.movie-card')
                                 .or(page.locator('nav'))
                                 .or(page.locator('header'))
                                 .or(page.locator('text=Home'))
                                 .or(page.locator('text=My List'));

    if (await dashboardSignals.count() > 0) return 'DASHBOARD';
    return 'UNKNOWN';
}

/**
 * 🔐 Action: Login
 */
async function doLogin(page: Page) {
    console.log('   🔐 State: AUTH. Filling credentials...');
    await page.fill('input[type="email"], input[name="email"]', USER.email);
    await delay(200);
    await page.fill('input[type="password"]', USER.password);
    
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.isVisible()) await btn.click();
    else await page.keyboard.press('Enter');
    
    console.log('   🚀 Submitted.');
    await delay(5000);
}

/**
 * 👥 Action: Select Profile
 */
async function doProfileSelection(page: Page) {
    console.log('   👥 State: PROFILES. Picking a user...');
    // Try to click the specific user text first
    const userText = page.locator(`text=${USER.email.split('@')[0]}`).first();
    const avatar = page.locator('.avatar, img[alt*="profile"]').first();
    
    if (await userText.isVisible()) await userText.click();
    else if (await avatar.isVisible()) await avatar.click();
    else {
        // Fallback: Click center of screen
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
    }
    await delay(5000);
}

/**
 * 🍿 Action: Browse & Click Movie
 */
async function doBrowse(page: Page) {
    console.log('   🍿 State: DASHBOARD. Hunting for content...');
    
    // Broad Search for ANY clickable content
    let candidates = page.locator('.movie-card, [role="article"]');
    if (await candidates.count() === 0) candidates = page.locator('a:has(img), button:has(img)');
    if (await candidates.count() === 0) {
         candidates = page.locator('button[aria-label*="Play"]')
                          .or(page.locator('.lucide-play'))
                          .or(page.locator('text=Play'));
    }

    const count = await candidates.count();
    if (count > 0) {
        const index = Math.floor(Math.random() * count);
        console.log(`      -> Found ${count} candidates. Clicking #${index}`);
        const target = candidates.nth(index);
        await target.scrollIntoViewIfNeeded();
        await target.hover();
        await delay(500);
        await target.click();
        
        await delay(3000);
        
        // Handle "Netflix-style" Modal Popup
        const modalPlay = page.locator('button:has-text("Play")')
                              .or(page.locator('button[aria-label="Play"]'));
                              
        if (await modalPlay.count() > 0 && await modalPlay.first().isVisible()) {
             console.log('      -> Modal detected. Clicking BIG Play button...');
             await modalPlay.first().click();
             await delay(2000);
        }
    } else {
        console.log('      -> No clickable movies found. Scrolling...');
        await page.mouse.wheel(0, 500);
        await delay(2000);
    }
}

/**
 * 📺 Action: Watch Video
 */
async function doWatch(page: Page) {
    console.log('   📺 State: WATCHING.');
    const watchTime = 8000 + Math.random() * 5000;
    
    // Simulate mouse movement to prevent "Idle" status
    await page.mouse.move(200, 200);
    await delay(watchTime);
    
    console.log('      -> Done. Going back.');
    await page.goBack();
    await delay(3000);
}

// --- MAIN LOOP ---

(async () => {
  // Launch with arguments to hide "Automation" flags
  const browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-blink-features=AutomationControlled' // Critical for stealth
      ]
  });
  
  // Create a context that mimics a real Desktop Mac
  const context = await browser.newContext({ 
    viewport: { width: 1440, height: 900 }, 
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    bypassCSP: true, 
    ignoreHTTPSErrors: true,
    hasTouch: false,
    isMobile: false,
    deviceScaleFactor: 2,
  });

  // 🕵️ INJECT STEALTH SCRIPTS
  // This runs in the browser before any page loads
  await context.addInitScript(() => {
    // 1. Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // 2. Mock Plugins (Headless has 0, Real has 3+)
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    // 3. Mock Languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
  
  const page = await context.newPage();

  // Network Logger: Check if PostHog data is flying
  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') {
          console.log(`   🎥 Sending REPLAY Data (${req.postData()?.length || 0} bytes)`);
      }
  });

  // Console Logger: See PostHog debug output
  page.on('console', msg => {
      const text = msg.text();
      if (text.includes('PostHog') || text.includes('posthog')) {
          console.log(`   [Page Log]: ${text}`);
      }
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    // Cookie Banner Smasher
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    // Force PostHog to start immediately
    await forcePostHogStart(page);

    // Run the behavior loop
    const maxSteps = 8;
    for (let step = 0; step < maxSteps; step++) {
        const state = await detectState(page);
        console.log(`🔄 Step ${step+1}/${maxSteps}: Detected [${state}]`);
        
        switch (state) {
            case 'AUTH': await doLogin(page); break;
            case 'PROFILES': await doProfileSelection(page); break;
            case 'DASHBOARD': await doBrowse(page); break;
            case 'WATCHING': await doWatch(page); break;
            case 'UNKNOWN':
                console.log('   ❓ Unknown state. Scrolling...');
                const loginBtn = page.locator('button:has-text("Sign in")').first();
                if (await loginBtn.isVisible()) await loginBtn.click();
                else await page.mouse.wheel(0, 500);
                break;
        }
        
        // Re-inject force start every few steps to ensure it stays on
        if (step % 2 === 0) await forcePostHogStart(page);
        
        await delay(3000);
    }

    console.log('⏳ Flushing Replay Buffer (Waiting 20s)...');
    await delay(20000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
