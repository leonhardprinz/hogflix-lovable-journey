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
        // SLOW: 50 steps is very lazy/human
        const steps = Math.max(30, Math.min(Math.floor(distance / 5), 80));

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
            await delay(400 + Math.random() * 300); 
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

// --- 3. CRITICAL: THE "NUCLEAR" PROFILE SMASHER ---

async function smashProfileGate(page: Page) {
    // Check if we are stuck
    if (page.url().includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0) {
        console.log('      -> 🛑 Profile Gate Detected. SMASHING...');
        
        // 1. Try your new specific text
        const startBtn = page.locator('text="CLICK TO START"').first();
        // 2. Try any avatar
        const avatar = page.locator('.avatar, img[alt*="profile"]').first();
        
        if (await startBtn.isVisible()) {
            await startBtn.click({ force: true }); // Force click ignores overlays
        } else if (await avatar.isVisible()) {
            await avatar.click({ force: true });
        } else {
            // Blind click center of screen
            const vp = page.viewportSize();
            if(vp) await page.mouse.click(vp.width/2, vp.height/2);
        }

        // Wait for navigation
        try { 
            await page.waitForURL(u => !u.toString().includes('profiles'), { timeout: 8000 });
            console.log('      ✅ Smashed through to Dashboard.');
        } catch(e) {
            console.log('      ⚠️ Navigation slow/failed.');
        }
    }
}

/**
 * 🧭 SPA NAVIGATOR: Moves without reloading page (Crucial for state)
 */
async function softNavigate(page: Page, path: string) {
    console.log(`      -> Soft Navigating to ${path}...`);
    
    // 1. Try finding a link in the UI first (Most human)
    const link = page.locator(`a[href="${path}"]`).first();
    if (await link.isVisible()) {
        await smartClick(page, await link.elementHandle());
        return;
    }

    // 2. JS Injection (Keeps React State alive)
    await page.evaluate((target) => {
        window.history.pushState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await delay(2000);
}

// --- 4. AI BRAIN ---

async function askGemini(page: Page, goal: string): Promise<number> {
    if (!CONFIG.geminiKey) return -1;
    
    // Smart Scraper: Filter out footer/invisible junk
    const elements = await page.$$('button, a, input, [role="button"], .movie-card');
    const descriptions = [];
    const vp = page.viewportSize();

    for (let i = 0; i < elements.length; i++) {
        const box = await elements[i].boundingBox();
        // Ignore if invisible or in footer area (> 1.5x viewport height)
        if (!box || (vp && box.y > vp.height * 1.5)) continue;
        
        const t = await elements[i].textContent().catch(()=>'');
        const l = await elements[i].getAttribute('aria-label').catch(()=>'');
        const card = (await elements[i].getAttribute('class'))?.includes('movie-card');
        
        if (!t?.trim() && !l && !card) continue;
        
        descriptions.push(`${i}: ${card ? '[MOVIE]' : ''} ${t?.substring(0,30)} ${l}`);
    }

    if (descriptions.length === 0) return -1;

    const prompt = `Goal: ${goal}. Screen:\n${descriptions.slice(0,20).join('\n')}\nReply ONLY with index.`;
    try {
        const result = await model.generateContent(prompt);
        const idx = parseInt(result.response.text().match(/\d+/)?.[0] || '-1');
        return isNaN(idx) ? -1 : idx;
    } catch(e) { return -1; }
}

// --- 5. JOURNEYS ---

async function journeyPricing(page: Page) {
    console.log('   💳 JOURNEY: Pricing');
    await smashProfileGate(page);
    await softNavigate(page, '/pricing');
    
    // Hover plans
    const plans = await page.$$('.pricing-card');
    for (const p of plans) { await humanMove(page, p); await delay(500); }

    // Rage Click
    const ult = page.locator('button:has-text("Ultimate")').first();
    if (await ult.isVisible()) {
        console.log('      -> Rage Clicking Ultimate...');
        await humanMove(page, await ult.elementHandle());
        await ult.click({ clickCount: 6, delay: 80 });
    }
    
    // Subscribe Standard
    const std = page.locator('button:has-text("Standard")').first();
    if (await std.isVisible()) {
        await smartClick(page, await std.elementHandle());
        await delay(2000);
        // Fill Fake Card
        if (await page.locator('input[placeholder*="Card"]').isVisible()) {
            console.log('      -> Filling Card...');
            await page.fill('input[placeholder*="Card"]', '4242424242424242');
            await page.fill('input[placeholder*="MM/YY"]', '12/25');
            await page.fill('input[placeholder*="CVC"]', '123');
            const pay = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').last();
            if (await pay.isVisible()) await smartClick(page, await pay.elementHandle());
        }
    }
}

async function journeySearch(page: Page) {
    console.log('   🔍 JOURNEY: Search');
    await smashProfileGate(page);
    
    const searchBtn = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
    if (await searchBtn.isVisible()) {
        await smartClick(page, await searchBtn.elementHandle());
        
        const term = ["Sci-Fi", "Hog", "Space", "Comedy"][Math.floor(Math.random()*4)];
        console.log(`      -> Searching "${term}"...`);
        await page.keyboard.type(term, { delay: 150 });
        await delay(500);
        await page.keyboard.press('Enter');
        await delay(3000);
        
        // AI Pick Result
        const choice = await askGemini(page, `Click a movie result for ${term}`);
        const cards = await page.$$('.movie-card');
        const target = cards[choice > -1 ? choice : 0];
        if (target) await smartClick(page, target);
    }
}

async function journeyWatch(page: Page) {
    console.log('   📺 JOURNEY: Watch');
    await smashProfileGate(page);

    if (!page.url().includes('watch')) {
        if (!page.url().includes('browse')) await softNavigate(page, '/browse');
        await delay(3000);
        
        const choice = await askGemini(page, "Pick a movie to watch");
        const cards = await page.$$('.movie-card');
        if (cards.length > 0) {
            const target = cards[choice > -1 ? choice : Math.floor(Math.random()*cards.length)];
            await smartClick(page, target);
            
            // Handle Modal
            await delay(2000);
            const play = page.locator('button:has-text("Play")').first();
            if (await play.isVisible()) await smartClick(page, await play.elementHandle());
        }
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // Verify & Force Play
    const playing = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true;
        try { await v.play(); return true; } catch(e) { return false; }
    });

    if (playing) {
        const duration = 40000 + Math.random() * 80000;
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s`);
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(5000);
            const x = Math.random() * 300;
            await page.mouse.move(300+x, 300+x, { steps: 30 });
        }
        await page.goBack();
    } else {
        console.log('      ⚠️ Playback failed. Back to Browse.');
        await softNavigate(page, '/browse');
    }
}

// --- 5. MAIN ---

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

            await smashProfileGate(page); // Run Bouncer

            const roll = Math.random();
            try {
                if (roll < 0.25) await journeyPricingCheckout(page);
                else if (roll < 0.50) await journeySearchAI(page);
                else await journeyWatch(page);
            } catch (e) {
                console.log('   ⚠️ Error:', e.message?.substring(0,50));
                await softNavigate(page, '/browse');
            }

            console.log('   ...transitioning...');
            await page.mouse.wheel(0, 400);
            await delay(3000);
            await forcePostHog(page);
            cycle++;
        }

        console.log('✅ Session Complete. Final Flush...');
        await delay(25000);

    } catch (e) {
        console.error('❌ Fatal Error:', e);
    } finally {
        await browser.close();
    }
})();
