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
        const steps = Math.max(25, Math.min(Math.floor(distance / 5), 80)); 

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

async function ensureDashboard(page: Page) {
    // 1. Handle Profile Gate (Nuclear Option)
    if (page.url().includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0) {
        console.log('      -> 🛑 Profile Gate. Clicking...');
        const startBtn = page.locator('text="CLICK TO START"').first();
        const avatar = page.locator('.avatar').first();

        if (await startBtn.isVisible()) await startBtn.click({ force: true });
        else if (await avatar.isVisible()) await avatar.click({ force: true });
        
        try { await page.waitForURL(u => !u.toString().includes('profiles'), { timeout: 8000 }); }
        catch (e) {}
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
    // Fallback
    await page.evaluate((path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await delay(2000);
}

// --- 3. JOURNEYS ---

// 💳 PRICING: Random plan selection + Rage Click test
async function journeyPricing(page: Page) {
    console.log('   💳 JOURNEY: Pricing');
    await ensureDashboard(page);
    await softNavigate(page, '/pricing');
    await delay(3000);

    // Random Plan Selection
    const roll = Math.random();
    
    if (roll < 0.33) {
        // TEST: Ultimate (Rage Click)
        const ult = page.locator('button:has-text("Ultimate")').first();
        if (await ult.isVisible()) {
            console.log('      -> Testing Ultimate (Rage Click)...');
            await humanMove(page, await ult.elementHandle());
            await ult.click({ clickCount: 6, delay: 80 });
        }
    } else {
        // TEST: Standard/Premium (Checkout)
        const planName = roll < 0.66 ? "Standard" : "Premium";
        console.log(`      -> Selecting ${planName} Plan...`);
        
        const btn = page.locator(`button:has-text("${planName}")`).first();
        if (await btn.isVisible()) {
            await smartClick(page, await btn.elementHandle());
            await delay(3000);
            
            // Check for Checkout Modal/Page
            if (await page.locator('input[placeholder*="Card"]').isVisible()) {
                console.log('      -> Filling Checkout Details...');
                await page.fill('input[placeholder*="Card"]', '4242424242424242');
                await delay(300);
                await page.fill('input[placeholder*="MM/YY"]', '12/25');
                await delay(300);
                await page.fill('input[placeholder*="CVC"]', '123');
                await delay(1000);
                
                const pay = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').last();
                if (await pay.isVisible()) await smartClick(page, await pay.elementHandle());
                
                await delay(5000); // Wait for success/fail toast
            }
        }
    }
}

// 🦔 CHAT: FlixBuddy Interaction
async function journeyChat(page: Page) {
    console.log('   🦔 JOURNEY: FlixBuddy Chat');
    await ensureDashboard(page);
    
    const widget = page.locator('.floating-hedgehog, [aria-label="Chat"]').first();
    if (await widget.isVisible()) {
        await smartClick(page, await widget.elementHandle());
        await delay(2000);
        
        const input = page.locator('input[placeholder*="Ask"], textarea').first();
        if (await input.isVisible()) {
            const prompts = ["Best sci-fi?", "Funny movies?", "Something with action", "Surprise me"];
            const prompt = prompts[Math.floor(Math.random() * prompts.length)];
            
            console.log(`      -> Asking: "${prompt}"`);
            await page.keyboard.type(prompt, { delay: 100 });
            await page.keyboard.press('Enter');
            
            // Wait and "Read" response
            console.log('      -> Reading response...');
            await delay(5000);
            
            // Close widget
            const close = page.locator('button[aria-label="Close"]').first();
            if (await close.isVisible()) await smartClick(page, await close.elementHandle());
        }
    } else {
        console.log('      ⚠️ Chat widget not found (Variant B?)');
    }
}

// 🔍 SEARCH: Type and Click
async function journeySearch(page: Page) {
    console.log('   🔍 JOURNEY: Search');
    await ensureDashboard(page);
    
    const searchBtn = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
    if (await searchBtn.isVisible()) {
        await smartClick(page, await searchBtn.elementHandle());
        await delay(1000);
        
        const term = ["Hog", "Sci-Fi", "Space", "Comedy"][Math.floor(Math.random()*4)];
        console.log(`      -> Searching "${term}"...`);
        await page.keyboard.type(term, { delay: 150 });
        await delay(500);
        await page.keyboard.press('Enter');
        await delay(4000);
        
        // Click first result
        const res = page.locator('.movie-card').first();
        if (await res.isVisible()) await smartClick(page, await res.elementHandle());
    }
}

// 📺 WATCH: Content Consumption
async function journeyWatch(page: Page) {
    console.log('   📺 JOURNEY: Watch Content');
    await ensureDashboard(page);

    // 1. Navigate to Video
    if (!page.url().includes('watch')) {
        if (!page.url().includes('browse')) await softNavigate(page, '/browse');
        await delay(3000);
        
        // Find all posters (ignore tiny icons)
        const images = await page.$$('img');
        const posters = [];
        for (const img of images) {
            const box = await img.boundingBox();
            if (box && box.width > 100 && box.height > 100) posters.push(img);
        }

        if (posters.length > 0) {
            // Random poster
            const target = posters[Math.floor(Math.random() * Math.min(6, posters.length))];
            console.log('      -> Clicking a Poster...');
            await smartClick(page, target);
            await delay(3000);
            
            // Check for Modal "Play" button
            const playBtn = page.locator('button:has-text("Play"), button[aria-label="Play"]').first();
            if (await playBtn.isVisible()) {
                console.log('      -> Clicking Modal Play...');
                await smartClick(page, await playBtn.elementHandle());
            }
        }
    }

    // 2. PREPARE PLAYER (Critical Fix)
    await delay(2000);
    // Scroll to TOP to ensure player is in view (fixes "stuck at bottom" issue)
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // 3. PLAYBACK LOOP
    const watchSeconds = [5, 12, 25, 60][Math.floor(Math.random() * 4)]; // Varied times
    console.log(`      -> Watching for ${watchSeconds}s...`);
    
    // Force Play via JS
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true;
        try { await v.play(); return true; } catch(e) { return false; }
    });

    if (isPlaying) {
        const start = Date.now();
        const duration = watchSeconds * 1000;
        
        while (Date.now() - start < duration) {
            await delay(3000);
            // Subtle mouse movement (Looking at controls?)
            const x = Math.random() * 500;
            await page.mouse.move(x, 200, { steps: 40 });
        }
        
        console.log('      -> Done watching. Going back.');
        await page.goBack();
        await delay(2000);
    } else {
        console.log('      ⚠️ Playback failed (No video tag?). Resetting.');
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

            await ensureDashboard(page);

            // Weighted Decisions
            const roll = Math.random();
            try {
                if (roll < 0.20) await journeyPricing(page);
                else if (roll < 0.35) await journeyChat(page); // New: Chat
                else if (roll < 0.50) await journeySearch(page);
                else await journeyWatch(page); // 50% Watch
            } catch (e) {
                console.log('   ⚠️ Journey Error:', e.message?.substring(0,50));
                await softNavigate(page, '/browse');
            }

            console.log('   ...browsing...');
            await page.mouse.wheel(0, 300);
            await delay(3000);
            await forcePostHog(page);
            cycle++;
        }

        console.log('✅ Session Complete. Flushing...');
        await delay(25000);

    } catch (e) {
        console.error('❌ Fatal Error:', e);
    } finally {
        await browser.close();
    }
})();
