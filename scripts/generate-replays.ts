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
// Fallback to Pro if Flash fails/is rate limited
const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"];

// Global Mouse State (prevents "Invalid Parameter" crash)
let MOUSE_STATE = { x: 0, y: 0 };

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- PHYSICS & MOVEMENT (THE HUMAN TOUCH) ---

/**
 * 🐭 Organic Movement: Moves mouse in a curve with variable speed.
 * High 'steps' = slower movement.
 */
async function humanMove(page: Page, target: ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;

        if (typeof target === 'object' && 'boundingBox' in target) {
            const box = await target.boundingBox();
            if (!box) return;
            // Aim for random point inside the box, not dead center
            targetX = box.x + (box.width * 0.2) + (Math.random() * box.width * 0.6);
            targetY = box.y + (box.height * 0.2) + (Math.random() * box.height * 0.6);
        } else if ('x' in target) {
            targetX = target.x;
            targetY = target.y;
        }

        // Clamp to Viewport to prevent crashes
        targetX = Math.max(5, Math.min(targetX, 1275));
        targetY = Math.max(5, Math.min(targetY, 795));

        // Physics Calculation
        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        // Slower movement: 40 steps minimum, up to 100 for long distances
        const steps = Math.max(40, Math.min(Math.floor(distance / 5), 100));

        await page.mouse.move(targetX, targetY, { steps });
        MOUSE_STATE = { x: targetX, y: targetY };
    } catch (e) { }
}

/**
 * 👆 Safe Click: Moves, Hesitates, then Clicks
 */
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
            await delay(300 + Math.random() * 400); // Cognitive pause
            await element.click();
            return true;
        }
    } catch(e) { return false; }
    return false;
}

// --- AI DECISION ENGINE ---

async function askGemini(page: Page, context: string, options: string[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1;
    
    const safeOptions = options.slice(0, 10); 
    const prompt = `Context: ${context}\nOptions:\n${safeOptions.map((opt, i) => `${i}. ${opt}`).join('\n')}\nReply ONLY with the index number.`;

    for (const modelName of MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const index = parseInt(result.response.text().trim());
            if (!isNaN(index)) return index;
        } catch (e) { /* Try next model */ }
    }
    return -1;
}

// --- CRITICAL HELPERS ---

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

/**
 * 🛡️ GATEKEEPER: Ensures we are not stuck on the profile screen.
 * Called at the start of EVERY cycle.
 */
async function passProfileGate(page: Page) {
    // Check 1: URL
    if (page.url().includes('profiles')) {
        console.log('      -> 🛑 On Profile URL. Clicking Avatar...');
        const avatar = page.locator('.avatar, img[alt*="profile"]').first();
        if (await avatar.isVisible()) await smartClick(page, await avatar.elementHandle());
        await delay(4000);
        return;
    }
    // Check 2: UI Text
    const text = page.locator('text=Who’s Watching?');
    if (await text.count() > 0 && await text.isVisible()) {
        console.log('      -> 🛑 "Who is Watching" detected. Clicking Avatar...');
        const avatar = page.locator('.avatar').first();
        if (await avatar.isVisible()) await smartClick(page, await avatar.elementHandle());
        await delay(4000);
    }
}

// --- JOURNEY MODULES ---

async function runJourneyPricing(page: Page) {
    console.log('   💳 JOURNEY: Pricing');
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(3000);

    const ultimateBtn = page.locator('button:has-text("Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Rage Clicking Ultimate...');
        await humanMove(page, await ultimateBtn.elementHandle());
        await ultimateBtn.click({ clickCount: 5, delay: 80 }); 
    }
    
    const standardBtn = page.locator('button:has-text("Standard")').first();
    if (await standardBtn.isVisible()) {
        await smartClick(page, await standardBtn.elementHandle());
        await delay(2000);
        // If checkout modal appears, fill fake data
        if (await page.locator('input[placeholder*="Card"]').isVisible()) {
            console.log('      -> Filling Checkout...');
            await page.fill('input[placeholder*="Card"]', '4242424242424242');
            await delay(500);
            const pay = page.locator('button:has-text("Subscribe")').first();
            if (await pay.isVisible()) await smartClick(page, await pay.elementHandle());
        }
    }
    await delay(3000);
}

async function runJourneySearch(page: Page) {
    console.log('   🔍 JOURNEY: Search');
    // Find Search Icon (Nav)
    const searchBtn = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
    
    if (await searchBtn.isVisible()) {
        await smartClick(page, await searchBtn.elementHandle());
        await delay(1000);
        
        const terms = ["hog", "sci-fi", "adventure", "space", "comedy"];
        const q = terms[Math.floor(Math.random()*terms.length)];
        
        console.log(`      -> Searching "${q}"...`);
        await page.keyboard.type(q, { delay: 200 }); // Slow typing
        await delay(3000);
        
        // Click first result
        const res = page.locator('.movie-card').first();
        if (await res.isVisible()) await smartClick(page, await res.elementHandle());
        await delay(3000);
    } else {
        console.log('      ⚠️ Search icon missing.');
    }
}

async function runJourneyWatch(page: Page) {
    console.log('   📺 JOURNEY: Deep Watch');
    
    // 1. Navigate if needed
    if (!page.url().includes('watch')) {
        if (!page.url().includes('browse')) await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);
        const card = page.locator('.movie-card').nth(Math.floor(Math.random()*4));
        if (await card.isVisible()) await smartClick(page, await card.elementHandle());
        await delay(2000);
        
        // Play button in modal?
        const play = page.locator('button:has-text("Play")').first();
        if (await play.isVisible()) await smartClick(page, await play.elementHandle());
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 6000 }); } catch(e) {}
    }

    // 2. Verify Video & Force Play
    const video = page.locator('video');
    try { await video.waitFor({ timeout: 5000 }); } catch(e) {
        console.log('      ⚠️ No <video> tag. Clicking center...');
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
    }

    // JS Force Play (Most reliable method)
    const playing = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true;
        try { await v.play(); return true; } catch(e) { return false; }
    });

    if (playing) {
        const duration = 45000 + Math.random() * 90000; // 45s - 2m
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s...`);
        const start = Date.now();
        
        while (Date.now() - start < duration) {
            await delay(5000);
            // 10% Chance to pause
            if (Math.random() < 0.1) {
                console.log('      -> User Pause');
                const box = await video.boundingBox();
                if (box) {
                    await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
                    await delay(2000);
                    await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
                }
            }
            // Micro-movements
            const x = Math.random() * 200;
            await page.mouse.move(300+x, 300+x, { steps: 20 });
        }
        await page.goBack();
    } else {
        console.log('      ⚠️ Playback failed. Exiting journey.');
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

    // Init Stealth
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
        
        // Allow time for redirect, but don't crash if it fails
        try { await page.waitForURL(/.*browse|.*profiles/, { timeout: 10000 }); } catch(e) {}

        // --- THE INVINCIBLE LOOP ---
        console.log('🎬 Starting Continuous Journey Loop...');
        let cycle = 1;

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Cycle #${cycle} (${remaining}s left) ---`);

            // 1. Always check Gatekeeper FIRST
            await passProfileGate(page);

            // 2. Execute Journey with Error Containment
            // This try/catch ensures the session NEVER ends early due to an element error
            try {
                const roll = Math.random();
                if (roll < 0.25) await runJourneyPricing(page);
                else if (roll < 0.50) await runJourneySearch(page);
                else await runJourneyWatch(page); // 50% chance to watch
            } catch (error) {
                console.log('   ⚠️ Journey Error (Recovering):', error.message?.substring(0, 50));
                await page.goto(`${CONFIG.baseUrl}/browse`); // Reset to safe state
            }

            // 3. Transition
            console.log('   ...transitioning...');
            await page.mouse.wheel(0, 400);
            await delay(3000);
            await forcePostHog(page);
            cycle++;
        }

        console.log('✅ Session Target Reached. Flushing...');
        await delay(20000);

    } catch (e) {
        console.error('❌ Fatal Error:', e);
    } finally {
        await browser.close();
    }
})();
