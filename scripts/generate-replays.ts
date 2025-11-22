import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- CONFIG ---
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

// --- UTILS ---

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

async function humanMove(page: Page, selectorOrEl: string | ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;
        if (typeof selectorOrEl === 'string' || (typeof selectorOrEl === 'object' && 'boundingBox' in selectorOrEl)) {
            let box;
            if (typeof selectorOrEl === 'string') {
                const el = page.locator(selectorOrEl).first();
                if (await el.count() > 0 && await el.isVisible()) box = await el.boundingBox();
            } else {
                box = await selectorOrEl.boundingBox();
            }
            if (!box) return;
            targetX = box.x + (box.width / 2) + (Math.random() * 20 - 10);
            targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
        } else if ('x' in selectorOrEl) {
            targetX = selectorOrEl.x;
            targetY = selectorOrEl.y;
        }

        // Slow, deliberate movement (Higher steps = slower)
        await page.mouse.move(targetX, targetY, { steps: 40 });
    } catch (e) { }
}

async function safeClick(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        await humanMove(page, selectorOrEl);
        await delay(300 + Math.random() * 300); // Human hesitation
        if (typeof selectorOrEl === 'string') await page.click(selectorOrEl);
        else await selectorOrEl.click();
        return true;
    } catch(e) { return false; }
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
    // Aggressively handle Profile Screen if it appears
    if (page.url().includes('profiles') || await page.locator('.avatar').count() > 0) {
        console.log('      -> 🛑 Profile Gate detected. Smashing through...');
        const namePart = CONFIG.users[0].email.split('@')[0].substring(0, 5);
        const specific = page.locator(`text=${namePart}`).first();
        const any = page.locator('.avatar').first();
        
        if (await specific.isVisible()) await safeClick(page, specific);
        else await safeClick(page, any);
        
        await delay(4000); // Wait for nav
    }
}

// --- JOURNEYS ---

async function journeyPricingCheckout(page: Page) {
    console.log('   💳 RUNNING: Pricing & Checkout Test');
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(3000);

    // 1. Rage Click Ultimate (Experiment)
    const ultimateBtn = page.locator('button:has-text("Ultimate"), button:has-text("Start Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Rage Clicking Ultimate Button...');
        await humanMove(page, ultimateBtn);
        await ultimateBtn.click({ clickCount: 6, delay: 80 });
        await delay(2000);
    }

    // 2. Try Real Subscribe (Standard Plan)
    const standardBtn = page.locator('button:has-text("Standard"), button:has-text("Start Standard")').first();
    if (await standardBtn.isVisible()) {
        console.log('      -> Starting Checkout Flow...');
        await safeClick(page, standardBtn);
        await delay(3000);
        
        // Fake Stripe Flow
        if (page.url().includes('checkout')) {
            console.log('      -> Filling Fake Card...');
            await page.fill('input[placeholder*="Card"]', '4242424242424242');
            await page.fill('input[placeholder*="MM/YY"]', '12/25');
            await page.fill('input[placeholder*="CVC"]', '123');
            await delay(1000);
            const payBtn = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').first();
            if (await payBtn.isVisible()) await safeClick(page, payBtn);
            await delay(5000);
        }
    }
}

async function journeySearch(page: Page) {
    console.log('   🔍 RUNNING: Search & AI Summary');
    await ensureDashboard(page);
    
    // Click Search Icon
    const searchIcon = page.locator('button[aria-label="Search"], .lucide-search').first();
    if (await searchIcon.isVisible()) {
        await safeClick(page, searchIcon);
        await delay(1000);
        
        // Type Query
        const queries = ["sci-fi", "hog", "adventure", "space"];
        const q = queries[Math.floor(Math.random() * queries.length)];
        console.log(`      -> Searching for "${q}"...`);
        await page.keyboard.type(q, { delay: 100 });
        await delay(3000);
        
        // Click Result
        const result = page.locator('.movie-card').first();
        if (await result.isVisible()) {
            await safeClick(page, result);
            await delay(3000);
        }
    }
}

async function journeyWatch(page: Page) {
    console.log('   📺 RUNNING: Deep Watch');
    await ensureDashboard(page);

    // 1. Get to Video (Force navigation if needed)
    if (!page.url().includes('watch')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);
        const card = page.locator('.movie-card').nth(Math.floor(Math.random()*3)); // Random of top 3
        if (await card.isVisible()) await safeClick(page, card);
        
        // Modal Play Button
        const playBtn = page.locator('button:has-text("Play")').first();
        if (await playBtn.isVisible()) await safeClick(page, playBtn);
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. Wait for Video Element
    const video = page.locator('video').first();
    try { 
        await video.waitFor({ timeout: 5000 });
    } catch(e) {
        console.log('      ⚠️ No video tag. Clicking center of screen to wake up player...');
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
        await delay(2000);
    }

    // 3. Force Play & Watch
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true; 
        try { await v.play(); return true; } catch(e) { return false; }
    });

    if (isPlaying) {
        const duration = 30000 + Math.random() * 90000; // 30s - 2m
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s...`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(5000);
            // Mouse jitter to keep session alive
            const x = Math.random() * 300;
            await page.mouse.move(300 + x, 300 + x, { steps: 20 });
        }
    } else {
        console.log('      -> Video failed to start. Retrying Browse.');
    }
}

// --- MAIN CONTROLLER ---

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
        
        // Wait for nav
        try { await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }); } catch(e) {}

        // --- CONTINUOUS LOOP ---
        console.log('🎬 Starting 5-Minute Journey Loop...');
        let journeyCount = 1;

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Cycle #${journeyCount} (${remaining}s left) ---`);
            
            await ensureDashboard(page);

            const roll = Math.random();
            if (roll < 0.2) await journeyPricingCheckout(page);
            else if (roll < 0.4) await journeySearch(page);
            else await journeyWatch(page); // 60% chance to watch
            
            console.log('   ...transitioning...');
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
