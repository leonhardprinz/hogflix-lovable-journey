import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- 1. CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes
    geminiKey: process.env.GEMINI_API_KEY,
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

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 2. THE "GHOST HAND" ENGINE ---

// Global state to track the mouse position manually
// This fixes the "Invalid parameters" error
let MOUSE_STATE = { x: 0, y: 0 };

/**
 * Moves the mouse naturally with gravity/curves
 */
async function humanMove(page: Page, target: string | ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0;
        let targetY = 0;

        // 1. Resolve Target Coordinates
        if (typeof target === 'string' || (typeof target === 'object' && 'boundingBox' in target)) {
            let box;
            if (typeof target === 'string') {
                const el = page.locator(target).first();
                if (await el.count() > 0 && await el.isVisible()) box = await el.boundingBox();
            } else {
                box = await target.boundingBox();
            }

            if (!box) return; // Element gone? Skip.
            
            // Aim for center with slight human error offset
            targetX = box.x + (box.width / 2) + (Math.random() * 20 - 10);
            targetY = box.y + (box.height / 2) + (Math.random() * 20 - 10);
        } else if ('x' in target && 'y' in target) {
            targetX = target.x;
            targetY = target.y;
        }

        // 2. Clamp to Viewport (Safety Fix)
        // Prevents "Input.dispatchMouseEvent: Invalid parameters"
        targetX = Math.max(1, Math.min(targetX, 1279));
        targetY = Math.max(1, Math.min(targetY, 799));

        // 3. Calculate Physics
        // Fitts's Law: Slow down as we approach, faster at start
        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        const steps = Math.max(25, Math.min(Math.floor(distance / 5), 100)); // More steps for longer distance

        // 4. Execute Move
        await page.mouse.move(targetX, targetY, { steps: steps });
        
        // Update global state
        MOUSE_STATE = { x: targetX, y: targetY };

    } catch (e) { 
        // Silent fail on movement is better than crashing the script
        // console.log('Move Error (Ignored):', e.message); 
    }
}

async function safeClick(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        await humanMove(page, selectorOrEl);
        await delay(100 + Math.random() * 200); // Human hesitation before press
        
        if (typeof selectorOrEl === 'string') await page.click(selectorOrEl);
        else await selectorOrEl.click();
        return true;
    } catch(e) { return false; }
}

/**
 * 📖 Simulates reading/thinking
 * Drifts the mouse slightly around the current point
 */
async function simulateReading(page: Page, durationMs: number = 3000) {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
        // Drift small amount from CURRENT known position
        const driftX = MOUSE_STATE.x + (Math.random() * 40 - 20);
        const driftY = MOUSE_STATE.y + (Math.random() * 20 - 10);
        
        await humanMove(page, { x: driftX, y: driftY });
        await delay(800 + Math.random() * 500);
    }
}

async function askGemini(page: Page, context: string, options: string[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1;
    try {
        const safeOptions = options.slice(0, 8); 
        const prompt = `Context: ${context}\nOptions:\n${safeOptions.map((opt, i) => `${i}. ${opt}`).join('\n')}\nReply ONLY with the index number.`;
        const result = await model.generateContent(prompt);
        const index = parseInt(result.response.text().trim());
        return isNaN(index) ? -1 : index;
    } catch (e) { return -1; }
}

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

async function ensureDashboard(page: Page) {
    if (page.url().includes('profiles') || await page.locator('.avatar').count() > 0) {
        console.log('      -> Stuck on Profiles. Clicking avatar...');
        await safeClick(page, '.avatar');
        await delay(4000);
    }
}

// --- 3. JOURNEYS ---

async function journeyPricing(page: Page) {
    console.log('   🏷️ RUNNING: Pricing Page');
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(4000);

    const plans = page.locator('.pricing-card');
    for (let i = 0; i < await plans.count(); i++) {
        await humanMove(page, plans.nth(i));
        await simulateReading(page, 1500); 
    }

    const ultimateBtn = page.locator('button:has-text("Ultimate"), button:has-text("Start Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Testing Ultimate Button');
        await humanMove(page, ultimateBtn);
        
        if (Math.random() > 0.5) {
            console.log('      😡 Rage Clicking...');
            await ultimateBtn.click({ clickCount: 6, delay: 80 });
        } else {
            await ultimateBtn.click();
        }
        await delay(3000);
    }
}

async function journeyBrowse(page: Page) {
    console.log('   🧭 RUNNING: Browse');
    await ensureDashboard(page);
    if (!page.url().includes('browse')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(4000);
    }

    // UI Check for Experiment
    const popular = await page.locator('text=Popular on HogFlix').isVisible();
    const trending = await page.locator('text=Trending Now').isVisible();
    console.log(`      -> UI Check: Popular=[${popular}] Trending=[${trending}]`);

    const cards = await page.locator('.movie-card').all();
    if (cards.length > 0) {
        const cardTexts = await Promise.all(cards.slice(0, 6).map(c => c.textContent()));
        const choiceIndex = await askGemini(page, `Pick a movie to watch.`, cardTexts as string[]);
        
        const finalIndex = (choiceIndex !== -1 && choiceIndex < cards.length) ? choiceIndex : Math.floor(Math.random() * Math.min(5, cards.length));
        
        console.log(`      -> Clicking card #${finalIndex}`);
        const target = cards[finalIndex];
        await safeClick(page, target);
        await delay(4000);
    }
}

async function journeyWatch(page: Page) {
    console.log('   📺 RUNNING: Deep Watch');
    await ensureDashboard(page);

    // 1. Get to Video
    if (!page.url().includes('watch')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);
        const card = page.locator('.movie-card').first();
        if (await card.isVisible()) await safeClick(page, card);
        
        // Modal handling
        const playBtn = page.locator('button:has-text("Play")').first();
        if (await playBtn.isVisible()) await safeClick(page, playBtn);
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. AI Summary
    const aiBtn = page.locator('button:has-text("Generate Summary")').first();
    if (await aiBtn.isVisible()) {
        console.log('      ✨ Generating AI Summary...');
        await safeClick(page, aiBtn);
        await simulateReading(page, 3000);
    }

    // 3. Watch Loop
    console.log('      -> Attempting playback...');
    const isPlaying = await page.evaluate(() => {
        const v = document.querySelector('video');
        if(v) { v.muted = true; v.play(); return true; }
        return false;
    });

    if (isPlaying) {
        // Watch for 45s to 3 mins
        const duration = 45000 + Math.random() * 100000; 
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(4000);
            // Gentle organic jitter
            const x = Math.random() * 100 - 50;
            const y = Math.random() * 100 - 50;
            await humanMove(page, { x: MOUSE_STATE.x + x, y: MOUSE_STATE.y + y });
            
            if (Math.random() < 0.05) {
                console.log('      -> Pausing briefly...');
                const vBox = await page.locator('video').boundingBox();
                if (vBox) {
                    await humanMove(page, page.locator('video').first());
                    await page.mouse.click(MOUSE_STATE.x, MOUSE_STATE.y);
                    await delay(2000);
                    await page.mouse.click(MOUSE_STATE.x, MOUSE_STATE.y);
                }
            }
        }
    }
}

// --- 4. MAIN CONTROLLER ---

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ 
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        deviceScaleFactor: 2,
        locale: 'en-US'
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    const page = await context.newPage();
    const sessionEndTime = Date.now() + CONFIG.minSessionDuration;

    try {
        console.log(`🔗 Visiting ${CONFIG.baseUrl}`);
        await page.goto(CONFIG.baseUrl);
        await delay(2000);
        
        const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Allow")').first();
        if (await cookieBtn.isVisible()) await safeClick(page, cookieBtn);
        await forcePostHog(page);

        // Login
        const user = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
        console.log(`🔐 Login: ${user.email}`);
        
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', user.email);
        await page.fill('input[type="password"]', user.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }).catch(() => {});

        if (page.url().includes('profiles')) {
            console.log('   -> Profile Screen.');
            await safeClick(page, '.avatar');
            await delay(4000);
        }

        // CONTINUOUS LOOP
        console.log('🎬 Starting Journey Loop (Target: 5m)...');
        let journeyCount = 1;

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Cycle #${journeyCount} (${remaining}s left) ---`);
            
            const roll = Math.random();
            if (roll < 0.2) await journeyPricing(page);
            else if (roll < 0.5) await journeyBrowse(page);
            else await journeyWatch(page);
            
            console.log('   ...transitioning...');
            await simulateReading(page, 3000);
            await forcePostHog(page);
            journeyCount++;
        }

        console.log('✅ Time Reached. Final Flush...');
        await delay(25000); 

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
