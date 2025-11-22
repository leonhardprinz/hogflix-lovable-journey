import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Apply Stealth
chromium.use(stealthPlugin());

// --- 1. CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes Target
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

// Initialize AI
const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 2. HUMAN BEHAVIOR ENGINE ---

/**
 * 🧠 AI Decision Maker
 */
async function askGemini(page: Page, context: string, options: string[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1;
    try {
        const safeOptions = options.slice(0, 10); 
        const prompt = `Context: ${context}. Options:\n${safeOptions.map((opt, i) => `${i}. ${opt}`).join('\n')}\nReply ONLY with the index number (0-${safeOptions.length-1}) of the most interesting option.`;
        const result = await model.generateContent(prompt);
        const index = parseInt(result.response.text().trim());
        return isNaN(index) ? -1 : index;
    } catch (e) { return -1; }
}

/**
 * 🐭 Organic Mouse Movement
 */
async function humanMove(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        let box;
        if (typeof selectorOrEl === 'string') {
            const el = page.locator(selectorOrEl).first();
            if (await el.count() > 0 && await el.isVisible()) box = await el.boundingBox();
        } else {
            box = await selectorOrEl.boundingBox();
        }

        if (box) {
            const x = box.x + box.width / 2 + (Math.random() * 20 - 10);
            const y = box.y + box.height / 2 + (Math.random() * 20 - 10);
            // Slower steps = More human
            await page.mouse.move(x, y, { steps: 35 + Math.random() * 20 });
        }
    } catch (e) { }
}

async function safeClick(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        await humanMove(page, selectorOrEl);
        if (typeof selectorOrEl === 'string') await page.click(selectorOrEl);
        else await selectorOrEl.click();
        return true;
    } catch(e) { return false; }
}

/**
 * 📖 Simulates reading content
 * Hovers over an element and drifts mouse slowly for a few seconds
 */
async function simulateReading(page: Page, durationMs: number = 3000) {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
        const driftX = Math.random() * 50 - 25;
        const driftY = Math.random() * 20 - 10;
        await page.mouse.move(page.mouse._x + driftX, page.mouse._y + driftY, { steps: 50 });
        await delay(500 + Math.random() * 500);
    }
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

// --- 3. JOURNEY DEFINITIONS ---

async function journeyPricing(page: Page) {
    console.log('   🏷️ STARTING: Pricing Page Investigation');
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(4000);

    const plans = page.locator('.pricing-card');
    for (let i = 0; i < await plans.count(); i++) {
        await humanMove(page, plans.nth(i));
        await simulateReading(page, 2000); // Read the plan features
    }

    // Rage Click Test
    const ultimateBtn = page.locator('button:has-text("Ultimate"), button:has-text("Start Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Interacting with Ultimate Button');
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
    console.log('   🧭 STARTING: Browse & Exploration');
    await ensureDashboard(page);
    
    if (!page.url().includes('browse')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(4000);
    }

    // Feature Flag Check
    const popular = await page.locator('text=Popular on HogFlix').isVisible();
    const trending = await page.locator('text=Trending Now').isVisible();
    console.log(`      -> UI Check: Popular=[${popular}] Trending=[${trending}]`);

    // Pick a movie via AI
    const cards = await page.locator('.movie-card').all();
    if (cards.length > 0) {
        // Scroll a bit first
        await page.mouse.wheel(0, 300);
        await delay(2000);

        const cardTexts = await Promise.all(cards.slice(0, 6).map(c => c.textContent()));
        const choiceIndex = await askGemini(page, `I want to watch a movie.`, cardTexts as string[]);
        
        const finalIndex = (choiceIndex !== -1 && choiceIndex < cards.length) ? choiceIndex : Math.floor(Math.random() * Math.min(5, cards.length));
        
        console.log(`      -> Interested in card #${finalIndex}`);
        const target = cards[finalIndex];
        
        await humanMove(page, target);
        await simulateReading(page, 1500); // Hover/Read
        await target.click();
        await delay(4000);
    }
}

async function journeyWatch(page: Page) {
    console.log('   📺 STARTING: Content Consumption');
    await ensureDashboard(page);

    // 1. Get to Video
    if (!page.url().includes('watch')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);
        // Click first available movie just to get to player
        const card = page.locator('.movie-card').first();
        if (await card.isVisible()) await safeClick(page, card);
        
        const playBtn = page.locator('button:has-text("Play")').first();
        if (await playBtn.isVisible()) await safeClick(page, playBtn);
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. AI Summary
    const aiBtn = page.locator('button:has-text("Generate Summary")').first();
    if (await aiBtn.isVisible()) {
        console.log('      ✨ Checking AI Summary...');
        await safeClick(page, aiBtn);
        await simulateReading(page, 4000); // Read the summary
    }

    // 3. WATCH LOOP
    console.log('      -> Attempting playback...');
    
    // Force Playback (The "Hammer")
    await page.evaluate(() => {
        const v = document.querySelector('video');
        if(v) { v.muted = true; v.play(); }
    });

    // Variable Watch Time
    const targetPercent = [0.1, 0.25, 0.5, 0.8][Math.floor(Math.random()*4)];
    const duration = 180000 * targetPercent; // Base on 3 minutes to allow for other journeys
    console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s`);
    
    const start = Date.now();
    while (Date.now() - start < duration) {
        // Every 5s, check if we should pause or wiggle
        await delay(5000);
        
        // Small Wiggle (Subconscious movement)
        const x = Math.random() * 200;
        await page.mouse.move(300 + x, 300 + x, { steps: 10 });
        
        // Rare Pause
        if (Math.random() < 0.05) {
            console.log('      -> Pausing briefly...');
            const vBox = await page.locator('video').boundingBox();
            if (vBox) {
                await page.mouse.click(vBox.x + vBox.width/2, vBox.y + vBox.height/2);
                await delay(3000);
                await page.mouse.click(vBox.x + vBox.width/2, vBox.y + vBox.height/2);
            }
        }
    }
    console.log('      -> Watch session complete.');
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
        if (await cookieBtn.isVisible()) await cookieBtn.click();
        await forcePostHog(page);

        // Login Phase
        const user = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
        console.log(`🔐 Logging in as ${user.email}`);
        
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', user.email);
        await page.fill('input[type="password"]', user.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }).catch(() => {});

        // Profile Check
        if (page.url().includes('profiles') || await page.locator('.avatar').count() > 0) {
            console.log('   -> Profile Screen. Clicking...');
            await safeClick(page, '.avatar');
            await delay(4000);
        }

        // --- THE CONTINUOUS ENGAGEMENT LOOP ---
        // We keep picking new journeys until the time is up.
        // This replaces the old "Run once then loiter" logic.
        
        console.log('🎬 Starting Continuous Journey Loop (Target: 5m)...');
        let journeyCount = 1;

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Journey Cycle #${journeyCount} (${remaining}s remaining) ---`);
            
            const roll = Math.random();
            
            // Weighted Selection
            // 50% Watch | 30% Browse | 20% Pricing
            if (roll < 0.2) await journeyPricing(page);
            else if (roll < 0.5) await journeyBrowse(page);
            else await journeyWatch(page);
            
            // Add a "Transition" pause between journeys
            console.log('   ...thinking (transitioning)...');
            await simulateReading(page, 3000);
            
            // Ensure PostHog is still alive
            await forcePostHog(page);
            
            journeyCount++;
        }

        console.log('✅ Session Time Reached. Final Flush...');
        await delay(25000); // Very generous flush window

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
