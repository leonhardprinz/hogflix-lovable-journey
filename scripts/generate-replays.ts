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
 * 🧠 The Brain: improved to detect Dashboard even if movies are loading
 */
async function detectState(page: Page) {
    const url = page.url();
    
    // 1. URL Checks (Fastest)
    if (url.includes('/auth') || url.includes('/login')) return 'AUTH';
    if (url.includes('/profiles')) return 'PROFILES';
    if (url.includes('/watch')) return 'WATCHING';
    
    // 2. UI Element Checks
    
    // AUTH: Look for password field
    if (await page.locator('input[type="password"]').count() > 0) return 'AUTH';
    
    // PROFILES: Look for "Who's Watching" text
    if (await page.locator('text=Who’s Watching?').count() > 0) return 'PROFILES';
    
    // DASHBOARD: (The Fix)
    // Don't just look for movies. Look for the Nav bar, Hero, or "Home" text.
    const dashboardSignals = page.locator('.movie-card')
                                 .or(page.locator('nav'))           // Navigation bar
                                 .or(page.locator('header'))        // Header
                                 .or(page.locator('text=Home'))     // Menu items
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
    if (await btn.isVisible()) {
        await btn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    console.log('   🚀 Submitted. Waiting for navigation...');
    await delay(5000);
}

/**
 * 👥 Action: Profile Selection
 */
async function doProfileSelection(page: Page) {
    console.log('   👥 State: PROFILES. Picking a user...');
    
    // Click the user text or avatar
    const userText = page.locator(`text=${USER.email.split('@')[0]}`).first();
    const avatar = page.locator('.avatar, img[alt*="profile"]').first();
    
    if (await userText.isVisible()) {
        await userText.click();
    } else if (await avatar.isVisible()) {
        await avatar.click();
    } else {
        // Blind click in center if selectors fail
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
    }
    
    console.log('   🖱️ Clicked Profile. Waiting for Dashboard to load...');
    // CRITICAL: Wait longer for the dashboard to render
    await delay(5000);
}

/**
 * 🍿 Action: Dashboard
 */
async function doBrowse(page: Page) {
    console.log('   🍿 State: DASHBOARD. Hunting for content...');
    
    const candidates = page.locator('.movie-card, img[alt*="Movie"], [role="img"]');
    
    if (await candidates.count() > 0) {
        // Pick a random movie
        const index = Math.floor(Math.random() * await candidates.count());
        console.log(`      -> Clicking movie #${index}`);
        
        await candidates.nth(index).hover();
        await delay(500);
        await candidates.nth(index).click();
        await delay(3000);
    } else {
        console.log('      -> No movies visible yet. Scrolling to trigger load...');
        await page.mouse.wheel(0, 500);
        await delay(2000);
    }
}

/**
 * 📺 Action: Watch
 */
async function doWatch(page: Page) {
    console.log('   📺 State: WATCHING.');
    // Watch for 5-10 seconds
    const watchTime = 5000 + Math.random() * 5000;
    await delay(watchTime);
    
    console.log('      -> Done. Going back.');
    await page.goBack();
    await delay(3000);
}

// --- MAIN LOOP ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Network Spy
  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') console.log('   🎥 Sending Replay Data');
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    // Cookie Smash
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    // Run the loop
    const maxSteps = 8;
    
    for (let step = 0; step < maxSteps; step++) {
        const state = await detectState(page);
        console.log(`🔄 Step ${step+1}/${maxSteps}: Detected [${state}] @ ${page.url()}`);
        
        switch (state) {
            case 'AUTH': await doLogin(page); break;
            case 'PROFILES': await doProfileSelection(page); break;
            case 'DASHBOARD': await doBrowse(page); break;
            case 'WATCHING': await doWatch(page); break;
            case 'UNKNOWN':
                console.log('   ❓ Unknown state. Scrolling and hoping for the best...');
                // Fallback: If we are stuck on landing page, click Sign In
                const loginBtn = page.locator('button:has-text("Sign in")').first();
                if (await loginBtn.isVisible()) {
                    await loginBtn.click();
                } else {
                    await page.mouse.wheel(0, 500);
                }
                break;
        }
        await delay(3000);
    }

    console.log('⏳ Flushing Replay Buffer (Waiting 15s)...');
    await delay(15000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
