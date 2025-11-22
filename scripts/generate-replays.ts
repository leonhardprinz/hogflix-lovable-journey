import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Apply Stealth
chromium.use(stealthPlugin());

// --- 1. CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes
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

// --- 2. UTILITIES (The "Human" Engine) ---

/**
 * 🧠 AI Decision Maker
 * Uses Gemini to look at text options and pick one.
 */
async function askGemini(page: Page, context: string, options: string[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1; // Fallback if no key
    try {
        // Limit options to save tokens/time
        const safeOptions = options.slice(0, 10); 
        const prompt = `
        Context: ${context}
        Options:
        ${safeOptions.map((opt, i) => `${i}. ${opt}`).join('\n')}
        
        Reply ONLY with the index number (0-${safeOptions.length-1}) of the best option to click.`;
        
        const result = await model.generateContent(prompt);
        const index = parseInt(result.response.text().trim());
        return isNaN(index) ? -1 : index;
    } catch (e) {
        console.log('      ⚠️ AI Brain Skip (Quota/Error)');
        return -1;
    }
}

/**
 * 🐭 Smooth Mouse Physics
 * Moves in steps to simulate human hand curve
 */
async function humanMove(page: Page, selector: string | ElementHandle) {
    try {
        let box;
        if (typeof selector === 'string') {
            const el = page.locator(selector).first();
            if (await el.count() > 0 && await el.isVisible()) box = await el.boundingBox();
        } else {
            box = await selector.boundingBox();
        }

        if (box) {
            // Target slightly off-center
            const targetX = box.x + (box.width / 2) + (Math.random() * 10 - 5);
            const targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
            
            // Get current position (or 0,0)
            // We use 'steps: 50' for visible, slow gliding
            await page.mouse.move(targetX, targetY, { steps: 50 });
        }
    } catch (e) { /* Ignore move errors */ }
}

async function safeClick(page: Page, selectorOrEl: string | ElementHandle) {
    try {
        await humanMove(page, selectorOrEl);
        if (typeof selectorOrEl === 'string') {
            await page.click(selectorOrEl);
        } else {
            await selectorOrEl.click();
        }
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

// Helper to get unstuck from profile screen
async function ensureDashboard(page: Page) {
    if (page.url().includes('profiles') || await page.locator('.avatar').count() > 0) {
        console.log('      -> Stuck on Profiles. Clicking avatar...');
        await safeClick(page, '.avatar');
        await delay(3000);
    }
}

// --- 3. JOURNEY DEFINITIONS ---

async function journeyPricing(page: Page) {
    console.log('   🏷️ RUNNING JOURNEY: Pricing Page CTA Test');
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(4000);

    // Hover Plans
    const plans = page.locator('.pricing-card');
    for (let i = 0; i < await plans.count(); i++) {
        await humanMove(page, plans.nth(i));
        await delay(800);
    }

    // Experiment: Ultimate Button
    const ultimateBtn = page.locator('button:has-text("Ultimate"), button:has-text("Start Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Interacting with Ultimate Button');
        await humanMove(page, ultimateBtn);
        
        // Rage Click Logic
        if (Math.random() > 0.5) {
            console.log('      😡 Rage Clicking...');
            await ultimateBtn.click({ clickCount: 5, delay: 100 });
        } else {
            await ultimateBtn.click();
        }
        await delay(3000);
    }
}

async function journeyBrowsePriority(page: Page) {
    console.log('   🧭 RUNNING JOURNEY: Browse Priority');
    await ensureDashboard(page);
    
    if (!page.url().includes('browse')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(4000);
    }

    const popular = await page.locator('text=Popular on HogFlix').isVisible();
    const trending = await page.locator('text=Trending Now').isVisible();
    
    let sectionName = "Generic";
    if (popular && !trending) sectionName = "POPULAR FIRST";
    else if (trending && !popular) sectionName = "TRENDING FIRST";
    
    console.log(`      -> Detected Variant: ${sectionName}`);

    // Find clickables
    const cards = await page.locator('.movie-card').all();
    if (cards.length > 0) {
        // 🧠 AI DECISION POINT
        const cardTexts = await Promise.all(cards.slice(0, 5).map(c => c.textContent()));
        const choiceIndex = await askGemini(page, `I am browsing the ${sectionName} section. Which movie sounds best?`, cardTexts as string[]);
        
        const finalIndex = (choiceIndex !== -1 && choiceIndex < cards.length) ? choiceIndex : 0; // Fallback to first
        
        console.log(`      -> Clicking card #${finalIndex}`);
        const target = cards[finalIndex];
        await humanMove(page, target);
        await target.click();
        await delay(3000);
    }
}

async function journeyDeepWatch(page: Page) {
    console.log('   📺 RUNNING JOURNEY: Deep Watch');
    await ensureDashboard(page);

    // Navigate to video if needed
    if (!page.url().includes('watch')) {
        await page.goto(`${CONFIG.baseUrl}/browse`);
        await delay(3000);
        const card = page.locator('.movie-card').first();
        if (await card.isVisible()) {
            await humanMove(page, card);
            await card.click();
        }
        // Handle Modal
        const playBtn = page.locator('button:has-text("Play")').first();
        if (await playBtn.isVisible()) await safeClick(page, playBtn);
        
        try { await page.waitForURL(/.*watch.*/, { timeout: 5000 }); } catch(e) {}
    }

    // AI Summary Interaction
    const aiBtn = page.locator('button:has-text("Generate Summary")').first();
    if (await aiBtn.isVisible()) {
        console.log('      ✨ AI Summary Interaction');
        await safeClick(page, aiBtn);
        await delay(4000);
    }

    // Force Video Play
    console.log('      -> Ensuring playback...');
    const isPlaying = await page.evaluate(() => {
        const v = document.querySelector('video');
        if(v) { v.muted = true; v.play(); return true; }
        return false;
    });

    if (isPlaying) {
        const duration = 45000 + Math.random() * 30000; // 45-75s
        console.log(`      -> Watching for ${duration/1000}s`);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(4000);
            // Micro-movements to keep session alive
            const x = Math.random() * 200;
            await page.mouse.move(300 + x, 300 + x, { steps: 15 });
        }
    } else {
        console.log('      ⚠️ No video found. Skipping watch.');
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

    // Stealth Init
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    const page = await context.newPage();
    const sessionEndTime = Date.now() + CONFIG.minSessionDuration;

    try {
        // --- AUTH ---
        console.log(`🔗 Visiting ${CONFIG.baseUrl}`);
        await page.goto(CONFIG.baseUrl);
        await delay(2000);
        
        await safeClick(page, 'button:has-text("Accept")');
        await forcePostHog(page);

        const user = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
        console.log(`🔐 Logging in as ${user.email}`);
        
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', user.email);
        await page.fill('input[type="password"]', user.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }).catch(() => {});

        // Profile Check (Crucial Fix)
        if (page.url().includes('profiles') || await page.locator('.avatar').count() > 0) {
            console.log('   -> Profile Screen Detected.');
            // AI Decision: Which profile? (Mocked by picking random or specific)
            const avatars = await page.locator('.avatar').all();
            if (avatars.length > 0) {
                await safeClick(page, avatars[0]);
            }
            await delay(3000);
        }

        // --- MULTI-JOURNEY LOOP ---
        // We run 2-3 journeys per session to simulate a real exploration
        const journeyCount = 2; 
        
        for (let i = 0; i < journeyCount; i++) {
            console.log(`🔄 Executing Module ${i+1}/${journeyCount}`);
            const roll = Math.random();
            
            if (roll < 0.3) await journeyPricing(page);
            else if (roll < 0.6) await journeyBrowsePriority(page);
            else await journeyDeepWatch(page);
            
            await delay(3000);
        }

        // --- LOITER PHASE ---
        console.log('🕰️ Entering Loiter Mode (Guaranteeing 5 mins)...');
        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now())/1000);
            if (remaining % 60 === 0) console.log(`   ...${remaining}s remaining`);
            
            await delay(5000);
            
            // Scroll & Move
            const y = Math.random() > 0.5 ? 300 : -300;
            await page.mouse.wheel(0, y);
            await page.mouse.move(Math.random()*500, Math.random()*500, { steps: 20 });
            
            // Occasional Navigation to keep things fresh
            if (Math.random() < 0.1) {
                const navLinks = await page.locator('nav a').all();
                if (navLinks.length > 0) {
                    await safeClick(page, navLinks[Math.floor(Math.random() * navLinks.length)]);
                }
            }
            
            if (Math.random() < 0.1) await forcePostHog(page);
        }

        console.log('✅ Session Target Duration Reached. Final Flush...');
        await delay(20000);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
