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
            // Aim for "meaty" part of element
            targetX = box.x + (box.width * 0.5) + (Math.random() * 10 - 5);
            targetY = box.y + (box.height * 0.5) + (Math.random() * 10 - 5);
        } else if ('x' in target) {
            targetX = target.x;
            targetY = target.y;
        }

        targetX = Math.max(5, Math.min(targetX, 1275));
        targetY = Math.max(5, Math.min(targetY, 795));

        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        // SLOWER: 60 steps is very lazy/human
        const steps = Math.max(40, Math.min(Math.floor(distance / 4), 80));

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
        
        if (element) {
            await humanMove(page, element);
            // Hover for a second like reading a tooltip
            await delay(500 + Math.random() * 500); 
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

// --- 3. SMART HELPERS ---

async function getPageSnapshot(page: Page) {
    const elements = await page.$$('button, a, input, [role="button"], .movie-card, video, h1, h2');
    const interactables: any[] = [];
    const viewport = page.viewportSize();

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const box = await el.boundingBox();
        
        if (!box || box.width < 10 || box.height < 10) continue;
        if (viewport && box.y > viewport.height * 2) continue;

        const text = await el.textContent().catch(()=>'') || '';
        const label = await el.getAttribute('aria-label').catch(()=>'') || '';
        const role = await el.getAttribute('role').catch(()=>'') || '';
        
        const isCard = (await el.getAttribute('class'))?.includes('movie-card');
        if (!text.trim() && !label && !isCard) continue;

        interactables.push({
            index: i,
            handle: el,
            description: `[${i}] Text:"${text.substring(0,40).replace(/\n/g,'')}" Label:"${label}" Role:"${role}"`
        });
    }
    return interactables;
}

async function askGemini(page: Page, goal: string): Promise<ElementHandle | null> {
    if (!CONFIG.geminiKey) return null;
    
    const interactables = await getPageSnapshot(page);
    if (interactables.length === 0) return null;

    const prompt = `
    GOAL: "${goal}"
    SCREEN ELEMENTS:
    ${interactables.map(i => i.description).join('\n')}
    
    INSTRUCTIONS:
    - Pick the SINGLE best element to click.
    - Reply ONLY with the index number (e.g., 5).
    `;

    try {
        const result = await model.generateContent(prompt);
        const index = parseInt(result.response.text().match(/\d+/)?.[0] || '-1');
        if (index !== -1) {
            const target = interactables.find(i => i.index === index);
            if (target) return target.handle;
        }
    } catch (e) { /* Ignore AI errors */ }
    return null;
}

// Helper to find a "Play" button
async function findPlayButton(page: Page) {
    let btn = page.locator('button[aria-label="Play"], button[title="Play"]').first();
    if (await btn.isVisible()) return btn;

    btn = page.locator('button:has-text("Play")').first();
    if (await btn.isVisible()) return btn;

    const playIcon = page.locator('svg path[d^="M"]').first(); 
    btn = page.locator('button:has(svg)').first();
    if (await btn.isVisible()) return btn;

    return null;
}

async function ensureDashboard(page: Page) {
    const url = page.url();
    // Check if stuck on profile (Updated for your new UI)
    const profileGate = page.locator('text=Who’s Watching?').first();
    
    if (url.includes('profiles') || await profileGate.isVisible()) {
        console.log('      -> 🛑 Profile Gate. Clicking "CLICK TO START"...');
        
        // 1. Try the new "CLICK TO START" button
        const startBtn = page.locator('button:has-text("CLICK TO START")').first();
        // 2. Try the new Hedgehog Image
        const hedgehogImg = page.locator('img[alt*="profile"], img[src*="hedgehog"]').first();
        // 3. Fallback to generic avatar class
        const avatar = page.locator('.avatar').first();

        if (await startBtn.isVisible()) await smartClick(page, await startBtn.elementHandle());
        else if (await hedgehogImg.isVisible()) await smartClick(page, await hedgehogImg.elementHandle());
        else if (await avatar.isVisible()) await smartClick(page, await avatar.elementHandle());
        
        try { await page.waitForURL(u => !u.toString().includes('profiles'), { timeout: 8000 }); }
        catch (e) {}
    }
}

// --- 4. JOURNEY MODULES ---

async function journeyPricingCheckout(page: Page) {
    console.log('   💳 JOURNEY: Pricing & Upgrade');
    await ensureDashboard(page);
    
    // Use AI to find Pricing link if possible, else direct
    const aiLink = await askGemini(page, "Navigate to the Pricing or Subscription page");
    if (aiLink) await smartClick(page, aiLink);
    else await page.goto(`${CONFIG.baseUrl}/pricing`);
    
    await delay(3000);

    // Rage Click Experiment
    const ultimateBtn = page.locator('button:has-text("Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Rage clicking Ultimate...');
        await humanMove(page, await ultimateBtn.elementHandle());
        await ultimateBtn.click({ clickCount: 6, delay: 80 });
    }

    // Checkout Flow
    const standardBtn = page.locator('button:has-text("Standard"), button:has-text("Subscribe")').first();
    if (await standardBtn.isVisible()) {
        console.log('      -> Attempting Subscribe...');
        await smartClick(page, await standardBtn.elementHandle());
        await delay(2000);
        
        // Fill Stripe Fake
        if (await page.locator('input[placeholder*="Card"]').isVisible()) {
            console.log('      -> Filling Credit Card...');
            await page.fill('input[placeholder*="Card"]', '4242424242424242');
            await delay(300);
            await page.fill('input[placeholder*="MM/YY"]', '12/25');
            await delay(300);
            await page.fill('input[placeholder*="CVC"]', '123');
            await delay(1000);
            
            const pay = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').last();
            if (await pay.isVisible()) await smartClick(page, await pay.elementHandle());
        }
    }
    await delay(3000);
}

async function journeySearchAI(page: Page) {
    console.log('   🔍 JOURNEY: Search Genres');
    await ensureDashboard(page);

    // 1. Find Search via AI
    const searchEl = await askGemini(page, "Find the Search button or icon");
    if (searchEl) await smartClick(page, searchEl);
    else {
        // Fallback selector
        const manualSearch = page.locator('.lucide-search, [aria-label="Search"]').first();
        if (await manualSearch.isVisible()) await smartClick(page, await manualSearch.elementHandle());
    }
    
    await delay(1500);

    // 2. Type Genre
    if (await page.locator('input[type="search"], input[placeholder*="Search"]').isVisible()) {
        const genres = ["Sci-Fi", "Comedy", "Hog", "Action", "Drama"];
        const genre = genres[Math.floor(Math.random()*genres.length)];
        console.log(`      -> Searching: "${genre}"`);
        
        await page.keyboard.type(genre, { delay: 150 });
        await delay(1000);
        
        // 🟢 FIX: Explicitly hit Enter to trigger search results page
        console.log('      -> Pressing Enter...');
        await page.keyboard.press('Enter');
        
        await delay(3000); // Wait for results
        
        // 3. Click Result
        const result = await askGemini(page, `Click the first movie result for ${genre}`);
        if (result) await smartClick(page, result);
        else {
            const manualRes = page.locator('.movie-card').first();
            if (await manualRes.isVisible()) await smartClick(page, await manualRes.elementHandle());
        }
        await delay(4000);
    }
}

async function journeyWatch(page: Page) {
    console.log('   📺 JOURNEY: Watch Content');
    await ensureDashboard(page);

    // 1. Find Movie (AI)
    if (!page.url().includes('watch')) {
        if (!page.url().includes('browse')) await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);

        const aiMovie = await askGemini(page, "Pick an interesting movie card to watch");
        if (aiMovie) await smartClick(page, aiMovie);
        else {
            const randomMovie = page.locator('.movie-card').nth(Math.floor(Math.random()*4));
            if (await randomMovie.isVisible()) await smartClick(page, await randomMovie.elementHandle());
        }
        await delay(3000);
    }

    // 2. Handle Modal / Play
    const playBtn = await findPlayButton(page);
    if (playBtn) {
        console.log('      -> Clicking Play Button...');
        await smartClick(page, await playBtn.elementHandle());
        await delay(3000);
    }

    // 3. Watch Loop
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        if (v.paused) { v.muted = true; try { await v.play(); } catch(e){} }
        return !v.paused;
    });

    if (isPlaying) {
        const duration = 60000 + Math.random() * 120000; // 1-3 mins
        console.log(`      -> Watching for ${(duration/1000).toFixed(0)}s`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(5000);
            // Drift mouse to keep session alive
            const x = Math.random() * 300;
            await page.mouse.move(200+x, 200+x, { steps: 30 });
        }
        await page.goBack();
    } else {
        console.log('      ⚠️ Playback not detected. Moving on.');
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

            await ensureDashboard(page);

            const roll = Math.random();
            try {
                if (roll < 0.25) await journeyPricingCheckout(page);
                else if (roll < 0.50) await journeySearchAI(page);
                else await journeyWatch(page); 
            } catch (e) {
                console.log('   ⚠️ Journey Interrupted:', e.message?.substring(0,50));
                await page.goto(`${CONFIG.baseUrl}/browse`);
            }

            console.log('   ...transitioning...');
            await page.mouse.wheel(0, 400);
            await delay(3000);
            await forcePostHog(page);
            cycle++;
        }

        console.log('✅ Session Complete. Final Flush...');
        await delay(20000);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
