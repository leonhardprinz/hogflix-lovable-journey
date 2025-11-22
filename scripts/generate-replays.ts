import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';

chromium.use(stealthPlugin());

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

// 👥 USER POOL
const USERS = [
    { email: 'summers.nor-7f@icloud.com',  password: 'zug2vec5ZBE.dkq*ubk' },
    { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
    { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' }
];

// Pick a random user for this session
const CURRENT_USER = USERS[Math.floor(Math.random() * USERS.length)];

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🐭 HUMAN MOUSE MOVEMENT
 * Moves the mouse in steps to simulate a human hand rather than teleporting.
 */
async function humanMove(page: Page, selector: string | ElementHandle) {
    let element;
    if (typeof selector === 'string') {
        element = page.locator(selector).first();
    } else {
        // Handle raw ElementHandle if passed
        // @ts-ignore
        element = selector; 
    }

    // If playright locator, ensure visibility
    if (typeof selector === 'string') {
        if (await element.count() === 0) return;
        await element.scrollIntoViewIfNeeded();
    }

    const box = await element.boundingBox();
    if (!box) return;

    // Calculate center with some randomness (humans rarely click exact center)
    const targetX = box.x + (box.width / 2) + (Math.random() * 10 - 5);
    const targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);

    // Get current mouse position
    // Note: Playwright doesn't expose current pos easily, so we assume 0,0 or last known
    // We just move in steps
    await page.mouse.move(targetX, targetY, { steps: 25 }); // 25 steps = smooth glide
}

/**
 * 😡 EMOTIONAL ENGINE
 * Simulates Dead Clicks (misses) and Rage Clicks (frustration)
 */
async function randomFrustration(page: Page) {
    const roll = Math.random();
    
    // 10% chance to Rage Click
    if (roll < 0.10) {
        console.log('      😡 Triggering RAGE CLICK...');
        // Find something not clickable (like a header or plain text)
        const annoyance = page.locator('h1, h2, p, span').first();
        if (await annoyance.isVisible()) {
            await humanMove(page, 'h1'); // Move to it first
            // Click 5 times fast
            await page.click('h1', { clickCount: 5, delay: 50 });
        }
    } 
    // 15% chance to Dead Click (click empty space)
    else if (roll < 0.25) {
        console.log('      💀 Triggering DEAD CLICK...');
        const vp = page.viewportSize();
        if (vp) {
            await page.mouse.click(vp.width - 50, vp.height / 2); // Click near edge
        }
    }
}

async function forcePostHogStart(page: Page) {
    await page.evaluate(() => {
        // @ts-ignore
        if (window.posthog) {
            // @ts-ignore
            window.posthog.register({ $device_type: 'Desktop', $browser: 'Chrome' });
            // @ts-ignore
            window.posthog.opt_in_capturing();
            // @ts-ignore
            window.posthog.startSessionRecording();
        }
    });
}

// --- STATE MACHINE ---

async function detectState(page: Page) {
    const url = page.url();
    if (url.includes('/auth') || url.includes('/login')) return 'AUTH';
    if (url.includes('/profiles')) return 'PROFILES';
    if (url.includes('/watch')) return 'WATCHING';
    
    if (await page.locator('input[type="password"]').count() > 0) return 'AUTH';
    if (await page.locator('text=Who’s Watching?').count() > 0) return 'PROFILES';
    
    // Check for dashboard OR generic pages (Pricing, Support)
    const navBar = page.locator('nav, header');
    if (await navBar.count() > 0) return 'DASHBOARD'; // We treat browsing pricing as dashboard behavior

    return 'UNKNOWN';
}

async function doLogin(page: Page) {
    console.log(`   🔐 State: AUTH. User: ${CURRENT_USER.email}`);
    
    await humanMove(page, 'input[type="email"]');
    await page.fill('input[type="email"], input[name="email"]', CURRENT_USER.email);
    await delay(300);
    
    await humanMove(page, 'input[type="password"]');
    await page.fill('input[type="password"]', CURRENT_USER.password);
    
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.isVisible()) {
        await humanMove(page, 'button[type="submit"]');
        await btn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    
    console.log('   🚀 Submitted.');
    await delay(5000);
}

async function doProfileSelection(page: Page) {
    console.log('   👥 State: PROFILES.');
    const userText = page.locator(`text=${CURRENT_USER.email.split('@')[0]}`).first();
    const avatar = page.locator('.avatar, img[alt*="profile"]').first();
    
    if (await userText.isVisible()) {
        await humanMove(page, `text=${CURRENT_USER.email.split('@')[0]}`);
        await userText.click();
    } else if (await avatar.isVisible()) {
        await humanMove(page, '.avatar');
        await avatar.click();
    } else {
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
    }
    await delay(5000);
}

async function doBrowse(page: Page) {
    console.log('   🍿 State: EXPLORING/DASHBOARD.');
    
    // Chance to Rage Click before doing anything
    await randomFrustration(page);

    // DECISION: 30% Explore Nav, 70% Click Movie
    const choice = Math.random();

    if (choice < 0.30) {
        // --- EXPLORE OTHER PAGES ---
        console.log('      -> Decision: Explore Navigation Links');
        const navLinks = page.locator('nav a, header a');
        const count = await navLinks.count();
        if (count > 0) {
            const idx = Math.floor(Math.random() * count);
            const link = navLinks.nth(idx);
            const text = await link.textContent();
            
            // Don't click "Sign Out"
            if (text && !text.toLowerCase().includes('out')) {
                console.log(`      -> Visiting: ${text}`);
                await humanMove(page, link);
                await link.click();
                await delay(4000); // Look at the page
                return; // Done with this step
            }
        }
    }

    // --- CLICK MOVIE ---
    console.log('      -> Decision: Watch Movie');
    let candidates = page.locator('.movie-card, [role="article"]');
    if (await candidates.count() === 0) candidates = page.locator('a:has(img), button:has(img)');
    
    const count = await candidates.count();
    if (count > 0) {
        const index = Math.floor(Math.random() * count);
        const target = candidates.nth(index);
        
        await target.scrollIntoViewIfNeeded();
        await humanMove(page, target); // Smooth move
        await delay(300);
        await target.click();
        
        await delay(3000);
        
        // Check for Modal "Play" button
        const modalPlay = page.locator('button:has-text("Play"), button[aria-label="Play"]');
        if (await modalPlay.count() > 0 && await modalPlay.first().isVisible()) {
             console.log('      -> Modal detected. Clicking Play.');
             await humanMove(page, modalPlay.first());
             await modalPlay.first().click();
             await delay(2000);
        }
    } else {
        console.log('      -> No movies. Scrolling...');
        await page.mouse.wheel(0, 500);
        await delay(2000);
    }
}

async function doWatch(page: Page) {
    // 3. DYNAMIC WATCH TIMES
    const scenarios = [0.30, 0.55, 0.75, 1.0]; // 30%, 55%, 75%, 100%
    const completionTarget = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    // Assume a "demo" video is roughly 30 seconds for this script
    // Or check if there is a duration element, but hardcoding variance is safer for demo
    const baseLength = 30000; 
    const watchTime = baseLength * completionTarget;

    console.log(`   📺 State: WATCHING. Target: ${completionTarget * 100}% (${watchTime/1000}s)`);
    
    // Move mouse initially to show controls
    await page.mouse.move(200, 200);
    
    // Check if we need to press play (sometimes autoplay fails)
    const video = page.locator('video');
    const playBtn = page.locator('button[aria-label="Play"], .lucide-play');
    
    // Simple heuristic: If video is paused, click play
    const isPaused = await page.evaluate(() => {
        const v = document.querySelector('video');
        return v ? v.paused : false;
    });

    if (isPaused) {
        console.log('      -> Video paused. Clicking Play.');
        if (await playBtn.count() > 0) {
            await humanMove(page, playBtn.first());
            await playBtn.first().click();
        } else {
            // Click center of video
            const vBox = await video.boundingBox();
            if (vBox) await page.mouse.click(vBox.x + vBox.width/2, vBox.y + vBox.height/2);
        }
    }

    // Watch loop
    const startTime = Date.now();
    while (Date.now() - startTime < watchTime) {
        // Every 5 seconds, maybe move mouse to look "engaged"
        await delay(5000);
        const roll = Math.random();
        if (roll > 0.7) {
            const x = Math.random() * 500;
            const y = Math.random() * 500;
            await page.mouse.move(x, y, { steps: 20 });
        }
    }
    
    console.log('      -> Watch complete. Leaving.');
    await page.goBack();
    await delay(3000);
}

// --- MAIN LOOP ---

(async () => {
  const browser = await chromium.launch({
      headless: true,
  });
  
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 2,
    locale: 'en-US'
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
  
  const page = await context.newPage();

  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') console.log(`   🎥 Sending REPLAY (${req.postData()?.length} bytes)`);
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    await forcePostHogStart(page);

    // Run loop
    const maxSteps = 10; // Increased steps for more exploration
    for (let step = 0; step < maxSteps; step++) {
        const state = await detectState(page);
        console.log(`🔄 Step ${step+1}/${maxSteps}: [${state}]`);
        
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
