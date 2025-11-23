import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- 1. CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes
    geminiKey: process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY,
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

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

let MOUSE_STATE = { x: 0, y: 0 };
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 2. PHYSICS ENGINE (The "Human" Part) ---

async function humanMove(page: Page, target: ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;

        if (typeof target === 'object' && 'boundingBox' in target) {
            const box = await target.boundingBox();
            if (!box) return;
            targetX = box.x + (box.width * 0.5);
            targetY = box.y + (box.height * 0.5);
        } else if ('x' in target) {
            targetX = target.x;
            targetY = target.y;
        }

        // Clamp to Viewport
        targetX = Math.max(1, Math.min(targetX, 1279));
        targetY = Math.max(1, Math.min(targetY, 799));

        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        const steps = Math.max(25, Math.min(Math.floor(distance / 6), 60)); // Smooth curve

        await page.mouse.move(targetX, targetY, { steps });
        MOUSE_STATE = { x: targetX, y: targetY };
    } catch (e) { }
}

async function smartClick(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        let element: ElementHandle | null = null;
        if (typeof selectorOrEl === 'string') {
            element = await page.locator(selectorOrEl).first().elementHandle();
        } else {
            element = selectorOrEl;
        }
        
        if (element && await element.isVisible()) {
            await humanMove(page, element);
            await delay(300 + Math.random() * 200);
            await element.click();
            return true;
        }
    } catch(e) { return false; }
    return false;
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

// --- 3. CRITICAL GATEKEEPING (The "Robot" Part) ---

async function ensureDashboard(page: Page) {
    // If we see "Who's Watching" or are on /profiles, we MUST break through.
    if (page.url().includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0) {
        console.log('      -> 🛑 Profile Gate detected. ENGAGING NUCLEAR CLICK.');
        
        // Hide the widget to prevent distraction/overlay
        await page.evaluate(() => {
            const widget = document.querySelector('.floating-hedgehog');
            if (widget) (widget as HTMLElement).style.display = 'none';
        });

        // TARGET YOUR SPECIFIC NEW UI
        const startButton = page.locator('text="CLICK TO START"').first();
        const hedgehogImg = page.locator('img[src*="hedgehog"]').first();
        
        // Force click ignores overlays/visibility checks
        if (await startButton.count() > 0) {
            await startButton.click({ force: true });
        } else if (await hedgehogImg.count() > 0) {
            await hedgehogImg.click({ force: true });
        } else {
            // Fallback to center screen click
            const vp = page.viewportSize();
            if (vp) await page.mouse.click(vp.width/2, vp.height/2);
        }

        // Wait for navigation away from profiles
        try { 
            await page.waitForURL(u => !u.toString().includes('profiles'), { timeout: 8000 });
            console.log('      ✅ Broken through to Dashboard.');
        } catch(e) {
            console.log('      ⚠️ Click registered, but navigation slow.');
        }
    }
}

// --- 4. JOURNEYS ---

async function askGemini(page: Page, context: string, options: string[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1;
    try {
        const safeOptions = options.slice(0, 10); 
        const prompt = `Context: ${context}\nOptions:\n${safeOptions.map((opt, i) => `${i}. ${opt}`).join('\n')}\nReply ONLY with the index number.`;
        const result = await model.generateContent(prompt);
        const index = parseInt(result.response.text().trim());
        return isNaN(index) ? -1 : index;
    } catch (e) { return -1; }
}

async function runJourneyPricing(page: Page) {
    console.log('   💳 JOURNEY: Pricing & Upgrade');
    await ensureDashboard(page);
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(3000);

    // Rage Click Experiment
    const ultimateBtn = page.locator('button:has-text("Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Rage clicking Ultimate...');
        await humanMove(page, await ultimateBtn.elementHandle());
        await ultimateBtn.click({ clickCount: 6, delay: 80 });
    }

    // Subscribe Standard
    const standardBtn = page.locator('button:has-text("Standard")').first();
    if (await standardBtn.isVisible()) {
        console.log('      -> Clicking Standard Plan...');
        await smartClick(page, await standardBtn.elementHandle());
        await delay(2000);
        
        if (await page.locator('input[placeholder*="Card"]').isVisible()) {
            console.log('      -> Filling Payment...');
            await page.fill('input[placeholder*="Card"]', '4242424242424242');
            await page.fill('input[placeholder*="MM/YY"]', '12/25');
            await page.fill('input[placeholder*="CVC"]', '123');
            await delay(1000);
            const pay = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').last();
            if (await pay.isVisible()) await smartClick(page, await pay.elementHandle());
        }
    }
}

async function runJourneySearch(page: Page) {
    console.log('   🔍 JOURNEY: Search');
    await ensureDashboard(page);
    
    // Find Search
    const searchBtn = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
    if (await searchBtn.isVisible()) {
        await smartClick(page, await searchBtn.elementHandle());
        await delay(1000);
        
        const term = ["Hog", "Sci-Fi", "Space", "Comedy"][Math.floor(Math.random()*4)];
        console.log(`      -> Searching "${term}"...`);
        await page.keyboard.type(term, { delay: 150 });
        await delay(1000);
        
        console.log('      -> Hitting Enter...');
        await page.keyboard.press('Enter');
        await delay(3000);
        
        // Use AI to pick result
        const cards = await page.locator('.movie-card').all();
        if (cards.length > 0) {
            const texts = await Promise.all(cards.slice(0,5).map(c => c.textContent()));
            const choice = await askGemini(page, "Pick a search result", texts as string[]);
            const target = cards[choice > -1 ? choice : 0];
            
            console.log('      -> Clicking result...');
            await smartClick(page, await target.elementHandle());
            await delay(3000);
        }
    }
}

async function runJourneyWatch(page: Page) {
    console.log('   📺 JOURNEY: Watch Content');
    await ensureDashboard(page);

    // 1. Find Movie
    if (!page.url().includes('watch')) {
        if (!page.url().includes('browse')) await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);
        
        // AI Selection
        const cards = await page.locator('.movie-card').all();
        if (cards.length > 0) {
            const texts = await Promise.all(cards.slice(0,5).map(c => c.textContent()));
            const choice = await askGemini(page, "Pick a movie to watch", texts as string[]);
            const target = cards[choice > -1 ? choice : 0];
            await smartClick(page, await target.elementHandle());
            
            // Modal Play
            await delay(2000);
            const play = page.locator('button:has-text("Play")').first();
            if (await play.isVisible()) await smartClick(page, await play.elementHandle());
        }
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. Force Play
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true;
        try { await v.play(); return true; } catch(e) { return false; }
    });

    if (isPlaying) {
        const duration = 45000 + Math.random() * 90000;
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(5000);
            // Keep Alive Jitter
            const x = Math.random() * 300;
            await page.mouse.move(300+x, 300+x, { steps: 25 });
        }
        await page.goBack();
    } else {
        console.log('      ⚠️ Video error. Resetting.');
        await page.goto(`${CONFIG.baseUrl}/browse`);
    }
}

// --- 5. MAIN EXECUTION ---

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
        
        const cookie = page.locator('button:has-text("Accept")').first();
        if (await cookie.isVisible()) await cookie.click();
        await forcePostHog(page);

        // Login
        const user = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
        console.log(`🔐 Login: ${user.email}`);
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', user.email);
        await page.fill('input[type="password"]', user.password);
        await page.click('button[type="submit"]');
        try { await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }); } catch(e) {}

        // START LOOP
        let cycle = 1;
        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Cycle #${cycle} (${remaining}s left) ---`);

            // 1. THE GATEKEEPER (Fixed)
            await ensureDashboard(page);

            // 2. JOURNEY SELECTOR
            const roll = Math.random();
            try {
                if (roll < 0.25) await journeyPricingCheckout(page);
                else if (roll < 0.50) await runJourneySearch(page);
                else await runJourneyWatch(page); 
            } catch (e) {
                console.log('   ⚠️ Journey Error:', e.message?.substring(0,50));
                await page.goto(`${CONFIG.baseUrl}/browse`);
            }

            // 3. TRANSITION
            console.log('   ...transitioning...');
            await page.mouse.wheel(0, 300);
            await delay(3000);
            await forcePostHog(page);
            cycle++;
        }

        console.log('✅ Session Complete. Flushing...');
        await delay(20000);

    } catch (e) {
        console.error('❌ Fatal Error:', e);
    } finally {
        await browser.close();
    }
})();
