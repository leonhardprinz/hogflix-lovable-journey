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
 * The "Brain" - Scans the page and decides what state we are in.
 */
async function detectState(page: Page) {
    const url = page.url();
    
    // 1. Check for specific URL patterns first
    if (url.includes('/auth') || url.includes('/login')) return 'AUTH';
    if (url.includes('/profiles')) return 'PROFILES';
    if (url.includes('/watch')) return 'WATCHING';
    
    // 2. Check for UI Elements
    if (await page.locator('input[type="password"]').count() > 0) return 'AUTH';
    if (await page.locator('text=Who’s Watching?').count() > 0) return 'PROFILES';
    if (await page.locator('.movie-card').count() > 0) return 'DASHBOARD';
    
    // Default fallback
    return 'UNKNOWN';
}

/**
 * Action: Handle Login
 */
async function doLogin(page: Page) {
    console.log('   🔐 State: AUTH. Filling credentials...');
    
    // 1. Fill
    await page.fill('input[type="email"], input[name="email"]', USER.email);
    await delay(200);
    await page.fill('input[type="password"]', USER.password);
    
    // 2. Submit
    // Try explicit button first, then Enter
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.isVisible()) {
        await btn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    
    console.log('   🚀 Submitted. Waiting for navigation...');
    await page.waitForLoadState('networkidle');
    await delay(3000); // Give app time to process
}

/**
 * Action: Handle Profile Selection (Your screenshot specific)
 */
async function doProfileSelection(page: Page) {
    console.log('   👥 State: PROFILES. Picking a user...');
    
    // Strategy: Find the container that holds the user name or icon
    // We look for the text of your user (from config) or generic profile items
    
    // 1. Try to click the specific user text if it exists
    const userText = page.locator(`text=${USER.email.split('@')[0]}`).first();
    const genericAvatar = page.locator('.avatar, [role="button"] img').first();
    
    // Broad click target: Click the center of the screen if elements are weird
    // (Often works for overlay menus)
    
    if (await userText.isVisible()) {
        console.log('      -> Clicking by Username Text');
        await userText.click();
    } else if (await genericAvatar.count() > 0) {
        console.log('      -> Clicking generic Avatar');
        await genericAvatar.click();
    } else {
        console.log('      -> fallback: Clicking center of page');
        const viewport = page.viewportSize();
        if (viewport) await page.mouse.click(viewport.width / 2, viewport.height / 2);
    }
    
    await delay(3000);
}

/**
 * Action: Dashboard / Browsing
 */
async function doBrowse(page: Page) {
    console.log('   🍿 State: DASHBOARD. Hunting for content...');
    
    // Find all potential clickables (Posters, Play buttons)
    const candidates = page.locator('.movie-card, img[alt*="Movie"], [role="img"]');
    const count = await candidates.count();
    
    if (count > 0) {
        const index = Math.floor(Math.random() * count);
        console.log(`      -> Clicking item ${index}/${count}`);
        
        // Hover first (triggers css effects)
        await candidates.nth(index).hover();
        await delay(500);
        await candidates.nth(index).click();
        
        await delay(3000); // Wait for transition
    } else {
        console.log('      -> No movies found? Scrolling...');
        await page.mouse.wheel(0, 500);
        await delay(2000);
    }
}

/**
 * Action: Watching Video
 */
async function doWatch(page: Page) {
    console.log('   📺 State: WATCHING. Enjoying the show...');
    
    // Stay here for a random time between 5s and 15s
    const watchTime = Math.floor(Math.random() * 10000) + 5000;
    
    // Simulate activity so we don't look idle
    const steps = 5;
    for(let i=0; i<steps; i++) {
        await page.mouse.move(Math.random() * 500, Math.random() * 500);
        await delay(watchTime / steps);
    }
    
    // Go back / Close
    console.log('      -> Done watching. Going back.');
    await page.goBack();
    await delay(2000);
}

// --- MAIN LOOP ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(2000);
    
    // Handle Cookie Banner (Always check first)
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    // --- THE AUTONOMOUS LOOP ---
    // We run this loop X times to simulate a session flow
    // 1 Loop = 1 Decision (Login -> Profile -> Watch -> Leave)
    
    const maxSteps = 6; // Limit steps to prevent infinite loops
    
    for (let step = 0; step < maxSteps; step++) {
        const state = await detectState(page);
        console.log(`🔄 Step ${step+1}/${maxSteps}: Detected State [${state}]`);
        
        switch (state) {
            case 'AUTH':
                await doLogin(page);
                break;
            case 'PROFILES':
                await doProfileSelection(page);
                break;
            case 'DASHBOARD':
                await doBrowse(page);
                break;
            case 'WATCHING':
                await doWatch(page);
                break;
            case 'UNKNOWN':
                // If we are logged in but on landing page, try to find "Log in" or "Launch"
                console.log('   ❓ Unknown state. Checking for navigation buttons...');
                const loginBtn = page.locator('button:has-text("Sign in"), a:has-text("Sign in")');
                if (await loginBtn.count() > 0) {
                    await loginBtn.first().click();
                } else {
                    // Just scroll
                    await page.mouse.wheel(0, 300);
                }
                await delay(2000);
                break;
        }
        
        // Wait between steps for network/transitions
        await delay(2000);
    }

    console.log('⏳ Flushing Replay Buffer (Waiting 15s)...');
    await delay(15000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
