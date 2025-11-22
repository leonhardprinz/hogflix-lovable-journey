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

// --- 2. THE "GHOST HAND" ENGINE ---

async function humanMove(page: Page, selectorOrEl: string | ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;
        // Resolve target logic
        if (typeof selectorOrEl === 'string' || (typeof selectorOrEl === 'object' && 'boundingBox' in selectorOrEl)) {
            let box;
            if (typeof selectorOrEl === 'string') {
                const el = page.locator(selectorOrEl).first();
                if (await el.count() > 0 && await el.isVisible()) box = await el.boundingBox();
            } else {
                box = await selectorOrEl.boundingBox();
            }
            if (!box) return;
            // Aim slightly off center
            targetX = box.x + (box.width / 2) + (Math.random() * 10 - 5);
            targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
        } else if ('x' in selectorOrEl) {
            targetX = selectorOrEl.x;
            targetY = selectorOrEl.y;
        }

        // VISIBLE SLOW MOVEMENT: Higher steps = Slower/Smoother
        // 50 steps is roughly 0.5-0.8 seconds of movement
        await page.mouse.move(targetX, targetY, { steps: 50 });
    } catch (e) { }
}

async function safeClick(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        await humanMove(page, selectorOrEl);
        await delay(300 + Math.random() * 200); // Pause before clicking
        if (typeof selectorOrEl === 'string') await page.click(selectorOrEl);
        else await selectorOrEl.click();
        return true;
    } catch(e) { return false; }
}

async function askGemini(page: Page, context: string, options: string[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1;
    try {
        const safeOptions = options.slice(0, 10); 
        const prompt = `Context: ${context}. Options:\n${safeOptions.map((opt, i) => `${i}. ${opt}`).join('\n')}\nReply ONLY with the index number.`;
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
 * 🛡️ THE BOUNCER V2: Fixed Logic
 * Only triggers if we are strictly on the profile selection screen
 */
async function ensureDashboard(page: Page) {
    // FIX: Look for specific "Who's Watching" text to avoid confusing Dashboard Avatar with Profile Gate
    const isProfileScreen = page.url().includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0;
    
    if (isProfileScreen) {
        console.log('      -> 🛑 Profile Gate detected. Selecting user...');
        
        const namePart = CURRENT_USER.email.split('@')[0].substring(0, 5);
        const specific = page.locator(`text=${namePart}`).first();
        const anyAvatar = page.locator('.avatar, img[alt*="profile"]').first();
        
        // Click
        if (await specific.isVisible()) await safeClick(page, specific);
        else await safeClick(page, anyAvatar);
        
        // Wait for navigation away from profiles
        try {
            await page.waitForURL(url => !url.toString().includes('profiles'), { timeout: 8000 });
            console.log('      ✅ Entered Dashboard.');
        } catch(e) {
            console.log('      ⚠️ Failed to pass gate. Retrying...');
        }
    }
}

// --- 4. JOURNEYS ---

async function journeyPricingCheckout(page: Page) {
    console.log('   💳 RUNNING: Pricing & Checkout');
    await ensureDashboard(page);
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(3000);

    // 1. Rage Click Ultimate
    const ultimateBtn = page.locator('button:has-text("Ultimate"), button:has-text("Start Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Rage Clicking Ultimate Button...');
        await humanMove(page, ultimateBtn);
        await ultimateBtn.click({ clickCount: 5, delay: 80 });
        await delay(2000);
    }

    // 2. Subscribe Standard
    const standardBtn = page.locator('button:has-text("Standard"), button:has-text("Start Standard")').first();
    if (await standardBtn.isVisible()) {
        console.log('      -> Starting Checkout...');
        await safeClick(page, standardBtn);
        
        // Wait for checkout URL or Modal
        await delay(3000);
        if (page.url().includes('checkout') || await page.locator('input[placeholder*="Card"]').count() > 0) {
            console.log('      -> Filling Fake Card...');
            await page.fill('input[placeholder*="Card"]', '4242424242424242');
            await page.fill('input[placeholder*="MM/YY"]', '12/25');
            await page.fill('input[placeholder*="CVC"]', '123');
            await delay(1000);
            const payBtn = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').first();
            if (await payBtn.isVisible()) await safeClick(page, payBtn);
            await delay(4000);
        }
    }
}

async function journeySearch(page: Page) {
    console.log('   🔍 RUNNING: Search');
    await ensureDashboard(page);
    
    // Find Search Button (Nav bar)
    const searchIcon = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
    
    if (await searchIcon.isVisible()) {
        await safeClick(page, searchIcon);
        await delay(1000);
        
        const queries = ["sci-fi", "hog", "adventure", "space", "comedy"];
        const q = queries[Math.floor(Math.random() * queries.length)];
        
        console.log(`      -> Searching for "${q}"...`);
        // Type slowly
        await page.keyboard.type(q, { delay: 150 });
        await delay(3000);
        
        // Check results
        const result = page.locator('.movie-card').first();
        if (await result.isVisible()) {
            console.log('      -> Clicking result...');
            await safeClick(page, result);
            await delay(3000);
        }
    } else {
        console.log('      ⚠️ Search icon not found.');
    }
}

async function journeyWatch(page: Page) {
    console.log('   📺 RUNNING: Deep Watch');
    await ensureDashboard(page);

    // 1. If not on watch page, find a movie
    if (!page.url().includes('watch')) {
        if (!page.url().includes('browse')) await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(2000);
        
        const card = page.locator('.movie-card').nth(Math.floor(Math.random()*3)); 
        if (await card.isVisible()) await safeClick(page, card);
        
        // Handle Modal Play Button
        const playBtn = page.locator('button:has-text("Play")').first();
        if (await playBtn.isVisible()) await safeClick(page, playBtn);
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. Verify Video Tag
    const video = page.locator('video').first();
    try { await video.waitFor({ timeout: 5000 }); } 
    catch(e) {
        console.log('      ⚠️ No video tag. Clicking center to force player wake-up...');
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
        await delay(2000);
    }

    // 3. Force Play via JS (Most reliable)
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true;
        try { await v.play(); return true; } catch(e) { return false; }
    });

    if (isPlaying) {
        // Watch for 45s to 2m
        const duration = 45000 + Math.random() * 75000;
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s...`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(5000);
            // Move mouse so controls overlay appears/disappears
            const x = Math.random() * 400;
            await page.mouse.move(300 + x, 300 + x, { steps: 25 });
        }
    } else {
        console.log('      -> Video failed to start. Going back to Browse.');
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
        await delay(3000); 
        
        // Cookie
        const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Allow")').first();
        if (await cookieBtn.isVisible()) await safeClick(page, cookieBtn);
        await forcePostHog(page);

        // Login
        console.log(`🔐 Login: ${CURRENT_USER.email}`);
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', CURRENT_USER.email);
        await page.fill('input[type="password"]', CURRENT_USER.password);
        await page.click('button[type="submit"]');
        
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
            else await journeyWatch(page);
            
            console.log('   ...transitioning...');
            // Simulate idle user behavior between tasks
            await page.mouse.wheel(0, 300);
            await delay(3000);
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
