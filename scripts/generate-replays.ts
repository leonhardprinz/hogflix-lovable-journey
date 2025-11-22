import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- 1. CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes Target
    geminiKey: process.env.GEMINI_API_KEY,
    users: [
        { email: 'toppers.tester_3c@icloud.com', password: 'sVcj_Z4HF4@sH24*xg36' },
        { email: 'slate-polders3m@icloud.com', password: 'wbt_-bwbkUe@y9J_J.sK' },
        { email: 'cabals-foyer-5w@icloud.com', password: '3f_ApN4jt4QQr@mYKg3Y' },
        { email: 'arroyo.gunner_6z@icloud.com', password: 'eavAX!qGPmHyP*J9TwKY' },
        { email: 'summers.nor-7f@icloud.com', password: 'zug2vec5ZBE.dkq*ubk' },
        { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
        { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' }
    ]
};

// Current session user
const CURRENT_USER = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 2. THE "GHOST HAND" ENGINE (Movement & State) ---

let MOUSE_STATE = { x: 0, y: 0 };

async function humanMove(page: Page, target: string | ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;

        if (typeof target === 'string' || (typeof target === 'object' && 'boundingBox' in target)) {
            let box;
            if (typeof target === 'string') {
                const el = page.locator(target).first();
                if (await el.count() > 0 && await el.isVisible()) box = await el.boundingBox();
            } else {
                box = await target.boundingBox();
            }
            if (!box) return; 
            targetX = box.x + (box.width / 2) + (Math.random() * 10 - 5);
            targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
        } else if ('x' in target && 'y' in target) {
            targetX = target.x;
            targetY = target.y;
        }

        targetX = Math.max(1, Math.min(targetX, 1279));
        targetY = Math.max(1, Math.min(targetY, 799));

        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        // Faster movement (15 steps) so we don't look like a sloth, but still curved
        const steps = Math.max(15, Math.min(Math.floor(distance / 10), 60)); 

        await page.mouse.move(targetX, targetY, { steps: steps });
        MOUSE_STATE = { x: targetX, y: targetY };
    } catch (e) { }
}

async function safeClick(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        await humanMove(page, selectorOrEl);
        await delay(100 + Math.random() * 100);
        if (typeof selectorOrEl === 'string') await page.click(selectorOrEl);
        else await selectorOrEl.click();
        return true;
    } catch(e) { return false; }
}

async function simulateReading(page: Page, durationMs: number = 2000) {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
        const driftX = MOUSE_STATE.x + (Math.random() * 20 - 10);
        const driftY = MOUSE_STATE.y + (Math.random() * 10 - 5);
        await humanMove(page, { x: driftX, y: driftY });
        await delay(600);
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

// --- 3. CRITICAL HELPERS ---

/**
 * 🛡️ THE BOUNCER: Refuses to proceed until we are OFF the profile page.
 * Retries clicking different elements until success.
 */
async function ensureDashboard(page: Page) {
    let attempts = 0;
    while (page.url().includes('profiles') && attempts < 5) {
        console.log(`      -> 🛑 Blocked at Profile Gate (Attempt ${attempts + 1}/5)`);
        
        // Strategy 1: Click text matching user email part
        const namePart = CURRENT_USER.email.split('@')[0].substring(0, 5);
        const specificProfile = page.locator(`text=${namePart}`).first();
        
        // Strategy 2: Click any avatar image
        const anyAvatar = page.locator('.avatar, img[alt*="profile"]').first();
        
        // Strategy 3: Click the center of the container
        const container = page.locator('.grid').first();

        if (await specificProfile.isVisible()) {
            console.log('         Targeting specific user name...');
            await safeClick(page, specificProfile);
        } else if (await anyAvatar.isVisible()) {
            console.log('         Targeting generic avatar...');
            await safeClick(page, anyAvatar);
        } else if (await container.isVisible()) {
            await safeClick(page, container);
        }

        // WAIT for navigation
        try {
            await page.waitForURL(url => !url.toString().includes('profiles'), { timeout: 5000 });
            console.log('      ✅ Broken through to Dashboard!');
            return; // Success!
        } catch(e) {
            console.log('         ...Click ignored. Retrying.');
        }
        attempts++;
    }
    
    if (page.url().includes('profiles')) {
        console.log('      ⚠️ CRITICAL: COULD NOT PASS PROFILE SCREEN. RELOADING.');
        await page.reload();
        await delay(5000);
    }
}

// --- 4. JOURNEYS ---

async function journeyPricing(page: Page) {
    console.log('   🏷️ RUNNING: Pricing Page');
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(4000);

    const plans = page.locator('.pricing-card');
    // Scroll down to see all plans
    await page.mouse.wheel(0, 500);
    await delay(1000);

    const ultimateBtn = page.locator('button:has-text("Ultimate"), button:has-text("Start Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Testing Ultimate Button');
        await humanMove(page, ultimateBtn);
        if (Math.random() > 0.5) await ultimateBtn.click({ clickCount: 6, delay: 80 });
        else await ultimateBtn.click();
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

    // Scroll to wake up lazy-loaded elements
    await page.mouse.wheel(0, 400);
    await delay(1000);

    const popular = await page.locator('text=Popular on HogFlix').isVisible();
    const trending = await page.locator('text=Trending Now').isVisible();
    console.log(`      -> Variant Check: Popular=[${popular}] Trending=[${trending}]`);

    const cards = await page.locator('.movie-card').all();
    if (cards.length > 0) {
        // 50% chance to ask AI, 50% chance to click random (faster)
        let index = 0;
        if (Math.random() > 0.5) {
            const texts = await Promise.all(cards.slice(0,5).map(c => c.textContent()));
            index = await askGemini(page, "Pick a movie", texts as string[]);
            if (index === -1) index = 0;
        } else {
            index = Math.floor(Math.random() * Math.min(5, cards.length));
        }

        const target = cards[index];
        await humanMove(page, target);
        await target.click();
        await delay(3000);
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
        
        const playBtn = page.locator('button:has-text("Play")').first();
        if (await playBtn.isVisible()) await safeClick(page, playBtn);
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. Ensure Playback
    console.log('      -> Checking playback status...');
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        if (v.paused) { v.muted = true; await v.play(); }
        return true;
    });

    if (isPlaying) {
        const duration = 30000 + Math.random() * 60000; // 30-90s
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(4000);
            // Active Watching: Wiggle mouse
            const x = Math.random() * 300;
            await page.mouse.move(200 + x, 200 + x, { steps: 15 });
        }
    } else {
        console.log('      ⚠️ No video found. Retrying dashboard...');
        await page.goto(`${CONFIG.baseUrl}/browse`);
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
        await delay(3000); // Wait for hydration
        
        // Cookie Banner
        const cookie = page.locator('button:has-text("Accept"), button:has-text("Allow")').first();
        if (await cookie.isVisible()) await safeClick(page, cookie);
        await forcePostHog(page);

        // Login
        console.log(`🔐 Login: ${CURRENT_USER.email}`);
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', CURRENT_USER.email);
        await page.fill('input[type="password"]', CURRENT_USER.password);
        await page.click('button[type="submit"]');
        
        // Wait specifically for the profile or dashboard redirect
        try {
            await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 });
        } catch(e) {
            console.log('   ⚠️ Login redirect timeout. Checking where we are...');
        }

        // --- CONTINUOUS LOOP ---
        console.log('🎬 Starting Active Journey Loop...');
        let journeyCount = 1;

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Cycle #${journeyCount} (${remaining}s left) ---`);
            
            // Ensure we aren't stuck on profiles before starting any journey
            await ensureDashboard(page);

            const roll = Math.random();
            if (roll < 0.2) await journeyPricing(page);
            else if (roll < 0.5) await journeyBrowse(page);
            else await journeyWatch(page);
            
            console.log('   ...transitioning...');
            
            // Active loiter: Scroll a bit between journeys
            await page.mouse.wheel(0, 400);
            await delay(2000);
            await forcePostHog(page);
            journeyCount++;
        }

        console.log('✅ Time Reached. Final Flush...');
        await delay(20000); 

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
