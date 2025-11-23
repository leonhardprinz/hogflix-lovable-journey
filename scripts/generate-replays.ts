import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. SETUP STEALTH
chromium.use(stealthPlugin());

// --- CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes Target
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

// Initialize AI
const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Mouse State Tracking
let MOUSE_STATE = { x: 0, y: 0 };
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 2. PHYSICS & UTILS ---

async function humanMove(page: Page, target: ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;

        if (typeof target === 'object' && 'boundingBox' in target) {
            const box = await target.boundingBox();
            if (!box) return;
            targetX = box.x + (box.width * 0.5) + (Math.random() * 10 - 5);
            targetY = box.y + (box.height * 0.5) + (Math.random() * 10 - 5);
        } else if ('x' in target) {
            targetX = target.x;
            targetY = target.y;
        }

        targetX = Math.max(5, Math.min(targetX, 1275));
        targetY = Math.max(5, Math.min(targetY, 795));

        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        const steps = Math.max(25, Math.min(Math.floor(distance / 6), 60)); 

        // TIMEOUT PROTECTION: If move takes > 2s, abort (prevents hangs)
        await Promise.race([
            page.mouse.move(targetX, targetY, { steps }),
            delay(2000)
        ]);
        
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
            await element.click({ timeout: 2000 }); // Short timeout
            return true;
        }
    } catch(e) { return false; }
    return false;
}

async function forcePostHog(page: Page) {
    try {
        await page.evaluate(() => {
            // @ts-ignore
            if (window.posthog) {
                // @ts-ignore
                window.posthog.opt_in_capturing();
                // @ts-ignore
                window.posthog.startSessionRecording();
            }
        });
    } catch(e) {}
}

// --- 3. CRITICAL HELPERS ---

/**
 * 🛡️ THE BOUNCER: Handles Profile Selection
 */
async function ensureDashboard(page: Page) {
    // Check 1: Are we on the profile page?
    if (page.url().includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0) {
        console.log('      -> 🛑 Profile Gate. Breaking through...');
        
        const startBtn = page.locator('text="CLICK TO START"').first();
        const hedgehog = page.locator('img[src*="hedgehog"]').first();
        const avatar = page.locator('.avatar').first();

        // Use force click to bypass overlays
        if (await startBtn.isVisible()) await startBtn.click({ force: true });
        else if (await hedgehog.isVisible()) await hedgehog.click({ force: true });
        else if (await avatar.isVisible()) await avatar.click({ force: true });
        
        // Hard wait for navigation
        try { await page.waitForURL(u => !u.toString().includes('profiles'), { timeout: 8000 }); }
        catch (e) { 
            console.log('      ⚠️ Profile transition slow. Reloading...');
            await page.reload(); // Reset state if stuck
            await delay(3000);
        }
    }
}

async function softNavigate(page: Page, path: string) {
    const targetUrl = `${CONFIG.baseUrl}${path}`;
    if (page.url() === targetUrl) return;

    console.log(`      -> Navigating to ${path}...`);
    const link = page.locator(`a[href="${path}"]`).first();
    if (await link.isVisible()) {
        await smartClick(page, await link.elementHandle());
        return;
    }
    // Fallback: JS Navigation
    await page.evaluate((path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await delay(2000);
}

// --- 4. JOURNEYS ---

async function askGemini(page: Page, goal: string): Promise<number> {
    if (!CONFIG.geminiKey) return -1;
    
    const elements = await page.$$('button, a, .movie-card');
    const descriptions = [];
    for(let i=0; i<Math.min(elements.length, 15); i++) {
        const t = await elements[i].textContent().catch(()=>'');
        descriptions.push(`${i}: ${t?.substring(0,20)}`);
    }

    if (descriptions.length === 0) return -1;

    const prompt = `Goal: ${goal}. Options:\n${descriptions.join('\n')}\nReply ONLY with index number.`;
    try {
        const result = await model.generateContent(prompt);
        const idx = parseInt(result.response.text().match(/\d+/)?.[0] || '-1');
        return isNaN(idx) ? -1 : idx;
    } catch(e) { return -1; }
}

async function journeyPricingCheckout(page: Page) {
    console.log('   💳 JOURNEY: Pricing & Checkout');
    await softNavigate(page, '/pricing');
    await delay(3000);

    const ultimateBtn = page.locator('button:has-text("Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Rage clicking Ultimate...');
        await humanMove(page, await ultimateBtn.elementHandle());
        await ultimateBtn.click({ clickCount: 6, delay: 80 });
    }

    const standardBtn = page.locator('button:has-text("Standard")').first();
    if (await standardBtn.isVisible()) {
        console.log('      -> Clicking Standard Plan...');
        await smartClick(page, await standardBtn.elementHandle());
        await delay(2000);
        
        if (await page.locator('input[placeholder*="Card"]').isVisible()) {
            console.log('      -> Filling Fake Card...');
            await page.fill('input[placeholder*="Card"]', '4242424242424242');
            await page.fill('input[placeholder*="MM/YY"]', '12/25');
            await page.fill('input[placeholder*="CVC"]', '123');
            await delay(1000);
            const pay = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').last();
            if (await pay.isVisible()) await smartClick(page, await pay.elementHandle());
        }
    }
    await delay(3000);
}

async function journeySearchAI(page: Page) {
    console.log('   🔍 JOURNEY: Search');
    
    const searchBtn = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
    if (await searchBtn.isVisible()) {
        await smartClick(page, await searchBtn.elementHandle());
        await delay(1000);
        
        const term = ["Hog", "Sci-Fi", "Space", "Comedy"][Math.floor(Math.random()*4)];
        console.log(`      -> Searching "${term}"...`);
        await page.keyboard.type(term, { delay: 150 });
        await delay(500);
        await page.keyboard.press('Enter');
        await delay(3000);
        
        const res = page.locator('.movie-card').first();
        if (await res.isVisible()) await smartClick(page, await res.elementHandle());
        await delay(3000);
    }
}

async function journeyWatch(page: Page) {
    console.log('   📺 JOURNEY: Watch Content');

    // 1. Navigate to Video if not there
    if (!page.url().includes('watch')) {
        if (!page.url().includes('browse')) await softNavigate(page, '/browse');
        await delay(3000);
        
        // Find posters
        const images = await page.$$('img');
        const posters = [];
        for (const img of images) {
            const box = await img.boundingBox();
            if (box && box.width > 100 && box.height > 100) posters.push(img);
        }

        if (posters.length > 0) {
            const target = posters[Math.floor(Math.random() * Math.min(6, posters.length))];
            console.log('      -> Clicking a Poster...');
            await smartClick(page, target);
            await delay(3000);
            
            // Modal Play
            const playBtn = page.locator('button:has-text("Play")').first();
            if (await playBtn.isVisible()) await smartClick(page, await playBtn.elementHandle());
        } else {
            console.log('      ⚠️ No posters. Forcing URL...');
            await page.goto(`${CONFIG.baseUrl}/watch/1`);
        }
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. Scroll to Top (Fixes "stuck at bottom" bug)
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(1000);

    // 3. Force Play
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true;
        try { await v.play(); return true; } catch(e) { return false; }
    });

    if (isPlaying) {
        const duration = 40000 + Math.random() * 80000;
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(5000);
            // Heartbeat Log (Prevents "Stuck" feeling in logs)
            console.log('      ...watching...');
            
            // Jitter to keep session alive
            const x = Math.random() * 300;
            
            // Protected Move (Prevents Freeze)
            try {
                await page.mouse.move(300+x, 300+x, { steps: 30 });
            } catch(e) {
                console.log('      ⚠️ Mouse stuck, skipping frame.');
            }
        }
        await page.goBack();
    } else {
        console.log('      ⚠️ Playback failed. Resetting.');
        await softNavigate(page, '/browse');
    }
}

// --- 5. MAIN CONTROLLER ---

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

        // LOOP
        let cycle = 1;
        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Cycle #${cycle} (${remaining}s left) ---`);

            // 1. Bouncer Check
            await ensureDashboard(page);

            // 2. Weighted Randomness
            const roll = Math.random();
            try {
                if (roll < 0.25) await journeyPricingCheckout(page);
                else if (roll < 0.50) await journeySearchAI(page);
                else await journeyWatch(page); 
            } catch (e) {
                console.log('   ⚠️ Journey Error:', e.message?.substring(0,50));
                await softNavigate(page, '/browse');
            }

            console.log('   ...transitioning...');
            await page.mouse.wheel(0, 400);
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
