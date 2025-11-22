import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';

// Apply the invisibility cloak to the browser
chromium.use(stealthPlugin());

// --- 1. CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    // CRITICAL: This forces the browser to stay open for 5 minutes minimum
    minSessionDuration: 300000, 
    users: [
        { email: 'summers.nor-7f@icloud.com', password: 'zug2vec5ZBE.dkq*ubk' },
        { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
        { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' },
        { email: 'toppers.tester_3c@icloud.com', password: 'sVcj_Z4HF4@sH24*xg36' },
        { email: 'slate-polders3m@icloud.com', password: 'wbt_-bwbkUe@y9J_J.sK' },
        { email: 'cabals-foyer-5w@icloud.com', password: '3f_ApN4jt4QQr@mYKg3Y' },
        { email: 'arroyo.gunner_6z@icloud.com', password: 'eavAX!qGPmHyP*J9TwKY' }
    ]
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 2. UTILITIES (The "Human" Engine) ---

// Moves mouse in a smooth curve instead of teleporting
async function humanMove(page: Page, selector: string | ElementHandle) {
    try {
        let box;
        if (typeof selector === 'string') {
            const el = page.locator(selector).first();
            if (await el.count() > 0) box = await el.boundingBox();
        } else {
            box = await selector.boundingBox();
        }

        if (box) {
            const x = box.x + box.width / 2 + (Math.random() * 20 - 10);
            const y = box.y + box.height / 2 + (Math.random() * 20 - 10);
            // 'steps: 25' makes the movement visible and human-like
            await page.mouse.move(x, y, { steps: 25 });
        }
    } catch (e) { /* Ignore move errors */ }
}

// Manually wakes up PostHog recording if it's sleeping
async function forcePostHog(page: Page) {
    await page.evaluate(() => {
        // @ts-ignore
        if (window.posthog) {
            // @ts-ignore
            window.posthog.opt_in_capturing();
            // @ts-ignore
            window.posthog.startSessionRecording();
        }
    });
}

// The "Loiter Mode" - Keeps session alive until 5 minutes is up
async function loiterUntil(page: Page, targetTime: number) {
    console.log('   🕰️ Entering Loiter Mode to hit duration target...');
    while (Date.now() < targetTime) {
        await delay(5000);
        
        // 1. Scroll up/down randomly
        const roll = Math.random();
        if (roll < 0.3) await page.mouse.wheel(0, 300); 
        else if (roll < 0.6) await page.mouse.wheel(0, -300);
        else {
            // 2. Jitter mouse (prevents "Idle" status)
            const x = Math.random() * 500;
            const y = Math.random() * 500;
            await page.mouse.move(x, y, { steps: 20 });
        }
        
        // 3. Re-inject recording command occasionally
        if (Math.random() < 0.1) await forcePostHog(page);
    }
}

// --- 3. JOURNEYS (Specific Missions) ---

// 🏷️ JOURNEY 1: Pricing & CTA Test
async function journeyPricing(page: Page) {
    console.log('   🏷️ RUNNING JOURNEY: Pricing Page CTA Test');
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(4000);

    // Hover over plans to inspect them
    // Use broad selector to catch any plan card
    const plans = page.locator('div[class*="card"], div[class*="plan"]');
    for (let i = 0; i < await plans.count(); i++) {
        await humanMove(page, plans.nth(i));
        await delay(1000);
    }

    // Test the "Ultimate" button (Rage Click Experiment)
    const ultimateBtn = page.locator('button:has-text("Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Testing Ultimate Button Interaction');
        await humanMove(page, ultimateBtn);
        
        // 50% chance to Rage Click
        if (Math.random() > 0.5) {
            console.log('      😡 Rage Clicking Ultimate Button...');
            await ultimateBtn.click({ clickCount: 5, delay: 100 });
        } else {
            await ultimateBtn.click();
        }
        await delay(3000);
    }
}

// 🧭 JOURNEY 2: Browse Priority
async function journeyBrowsePriority(page: Page) {
    console.log('   🧭 RUNNING JOURNEY: Browse Priority');
    await page.goto(`${CONFIG.baseUrl}/browse`);
    await delay(4000);

    // Feature Flag Detection: Which header is visible?
    const popular = await page.locator('text=Popular on HogFlix').isVisible();
    const trending = await page.locator('text=Trending Now').isVisible();
    
    let targetSection;
    if (popular && !trending) {
        console.log('      -> Variant Identified: POPULAR FIRST');
        // Find a card strictly inside the Popular section
        targetSection = page.locator(':text("Popular on HogFlix") ~ div .movie-card');
    } else if (trending && !popular) {
        console.log('      -> Variant Identified: TRENDING FIRST');
        targetSection = page.locator(':text("Trending Now") ~ div .movie-card');
    } else {
        console.log('      -> Control/Mixed. Using generic selector.');
        targetSection = page.locator('.movie-card');
    }

    if (await targetSection.count() > 0) {
        const card = targetSection.nth(1); // Click the 2nd one
        await humanMove(page, card);
        await card.click();
        console.log('      -> Clicked movie card.');
    }
}

// 📺 JOURNEY 3: Deep Watch
async function journeyDeepWatch(page: Page) {
    console.log('   📺 RUNNING JOURNEY: Deep Watch');
    
    // 1. Navigate to video if not there
    if (!page.url().includes('watch')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);
        
        // Try clicking a movie image
        const card = page.locator('img[alt*="Movie"], .movie-card').first();
        if (await card.isVisible()) await card.click();
        
        // Handle "Play" button in Modal
        const playBtn = page.locator('button:has-text("Play")').first();
        if (await playBtn.isVisible()) await playBtn.click();
        
        // Wait for URL change
        try { await page.waitForURL(/.*watch.*/, { timeout: 5000 }); } catch(e) {}
    }

    // 2. AI Summary (Early Access Test)
    const aiBtn = page.locator('button:has-text("Generate Summary")').first();
    if (await aiBtn.isVisible()) {
        console.log('      ✨ AI Summary Feature Visible. Interacting...');
        await humanMove(page, aiBtn);
        await aiBtn.click();
        await delay(5000); // Wait for generation
    }

    // 3. Watch Logic
    console.log('      -> Waiting for video player...');
    const video = page.locator('video').first();
    
    // JS Injection: Force the video to play if UI fails
    await page.evaluate(() => {
        const v = document.querySelector('video');
        if(v) { v.muted = true; v.play(); }
    });

    // Watch for random %
    const targetPercent = [0.3, 0.55, 0.75, 1.0][Math.floor(Math.random()*4)];
    const duration = 60000 * targetPercent; // Scale to 1 min base for demo
    
    console.log(`      -> Watching for ${duration/1000}s (${targetPercent*100}%)`);
    
    const start = Date.now();
    while (Date.now() - start < duration) {
        await delay(5000);
        // Mouse jitter to keep alive
        const x = Math.random() * 300;
        await page.mouse.move(200 + x, 200 + x);
    }
    console.log('      -> Watch complete.');
}

// 🦔 JOURNEY 4: Floating Widget
async function journeyFloatingWidget(page: Page) {
    console.log('   🦔 RUNNING JOURNEY: Floating Widget');
    await page.goto(`${CONFIG.baseUrl}/`);
    await delay(3000);

    const widget = page.locator('.floating-hedgehog, [aria-label="Chat"]').first();
    if (await widget.isVisible()) {
        console.log('      -> Widget visible (Variant A or Control). Clicking...');
        await humanMove(page, widget);
        await widget.click();
        await delay(5000);
    } else {
        console.log('      -> Widget hidden (Variant B). Working as intended.');
    }
}

// --- 4. MAIN CONTROLLER ---

(async () => {
    // Launch browser using playwright-extra (Stealth Mode)
    const browser = await chromium.launch({ headless: true });
    
    const context = await browser.newContext({ 
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        deviceScaleFactor: 2,
        locale: 'en-US'
    });

    const page = await context.newPage();
    // Calculate when we are allowed to stop (Now + 5 mins)
    const sessionEndTime = Date.now() + CONFIG.minSessionDuration;

    try {
        // --- AUTH PHASE ---
        console.log(`🔗 Visiting ${CONFIG.baseUrl}`);
        await page.goto(CONFIG.baseUrl);
        await delay(2000);
        
        // Cookie Banner
        const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Allow")').first();
        if (await cookieBtn.isVisible()) await cookieBtn.click();

        // Login
        const user = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
        console.log(`🔐 Logging in as ${user.email}`);
        
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', user.email);
        await page.fill('input[type="password"]', user.password);
        await page.click('button[type="submit"]');
        // Wait for dashboard redirect
        await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }).catch(() => console.log('Login redirect timeout'));

        // Profile Check
        if (page.url().includes('profiles')) {
            const profile = page.locator('.avatar, img[alt*="profile"]').first();
            if (await profile.isVisible()) await profile.click();
            await delay(3000);
        }

        // --- JOURNEY PHASE ---
        // Randomly pick one specific mission for this session
        const roll = Math.random();
        if (roll < 0.25) await journeyPricing(page);
        else if (roll < 0.50) await journeyBrowsePriority(page);
        else if (roll < 0.75) await journeyDeepWatch(page);
        else await journeyFloatingWidget(page);

        // --- LOITER PHASE (The 5-Min Guarantee) ---
        // This loop prevents the browser from closing until the time is up.
        // This solves the "1:30 cutoff" issue.
        await loiterUntil(page, sessionEndTime);

        console.log('✅ Session Target Duration Reached. Flushing...');
        
        // Final hard wait to ensure PostHog uploads the last chunk
        await delay(20000); 

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
