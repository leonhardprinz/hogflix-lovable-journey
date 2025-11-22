import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- CONFIG ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes
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

const CURRENT_USER = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 1. AI ENGINE (With Model Cascade) ---

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');

// List of models to try in order of cost/speed
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"];

async function askGeminiAction(goal: string, elements: any[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1;

    // Prepare Prompt
    const screenDump = elements.map(e => e.description).join('\n');
    const prompt = `
    GOAL: "${goal}"
    UI ELEMENTS:
    ${screenDump}
    
    Reply ONLY with the Index Number ([x]) of the element that best achieves the goal.
    If I am on a profile screen, ALWAYS pick a user profile.
    If I am watching a video, pick the back button or nothing (-1).
    If nothing fits, reply -1.
    `;

    // Cascade Loop: Try models one by one until one works
    for (const modelName of MODELS_TO_TRY) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = result.response.text().trim();
            
            const match = response.match(/\d+/);
            if (match) return parseInt(match[0]);
            return -1; // If AI replies but finds nothing

        } catch (e: any) {
            // If rate limited or not found, try next model
            if (e.message?.includes('429') || e.message?.includes('404') || e.message?.includes('quota')) {
                console.log(`      ⚠️ ${modelName} limit hit. Trying next...`);
                continue; 
            }
            console.log('      ⚠️ AI Error:', e.message.substring(0, 50));
            break; // Unknown error, stop trying
        }
    }
    return -1; // All models failed
}

// --- 2. THE "GHOST HAND" (Physics) ---

let MOUSE_STATE = { x: 0, y: 0 };

async function humanMove(page: Page, target: ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;

        if ('boundingBox' in target) {
            const box = await target.boundingBox();
            if (!box) return;
            targetX = box.x + (box.width / 2) + (Math.random() * 20 - 10);
            targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
        } else {
            targetX = target.x;
            targetY = target.y;
        }

        // Clamp to safe viewport
        targetX = Math.max(5, Math.min(targetX, 1275));
        targetY = Math.max(5, Math.min(targetY, 795));

        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        const steps = Math.max(20, Math.min(Math.floor(distance / 8), 60));

        await page.mouse.move(targetX, targetY, { steps });
        MOUSE_STATE = { x: targetX, y: targetY };
    } catch (e) { }
}

async function smartClick(page: Page, element: ElementHandle) {
    try {
        await humanMove(page, element);
        await delay(200 + Math.random() * 300);
        await element.click();
        return true;
    } catch(e) { return false; }
}

async function forcePostHog(page: Page) {
    await page.evaluate(() => {
        // @ts-ignore
        if (window.posthog) {
            // @ts-ignore
            window.posthog.register({ $device_type: 'Desktop', $browser: 'Chrome', synthetic: true });
            // @ts-ignore
            window.posthog.opt_in_capturing();
            // @ts-ignore
            window.posthog.startSessionRecording();
        }
    });
}

// --- 3. HEURISTIC FALLBACK (The "Dumb" Brain) ---
// Ensures we NEVER just scroll aimlessly if AI is dead.

async function runHeuristicFallback(page: Page, goal: string) {
    console.log('      🧩 Running Heuristic Fallback...');
    const url = page.url();

    // 1. Stuck on Profile?
    if (url.includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0) {
        console.log('         -> Selecting Profile (Fallback)');
        const avatar = page.locator('.avatar, img[alt*="profile"]').first();
        if (await avatar.isVisible()) await smartClick(page, avatar);
        return;
    }

    // 2. Watching Video?
    if (url.includes('watch')) {
        // Force play
        await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v) { v.muted = true; v.play(); }
        });
        await delay(10000); // Watch for 10s
        if (Math.random() < 0.2) await page.goBack();
        return;
    }

    // 3. Dashboard Actions
    if (goal.includes("search")) {
        // Try finding search icon or button
        const searchBtn = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
        if (await searchBtn.isVisible()) {
            await smartClick(page, searchBtn);
            await delay(1000);
            const terms = ["hog", "sci-fi", "adventure", "space"];
            await page.keyboard.type(terms[Math.floor(Math.random()*terms.length)], { delay: 200 });
            await delay(2000);
            await page.keyboard.press('Enter');
            // Click first result
            const result = page.locator('.movie-card').first();
            if (await result.isVisible()) await smartClick(page, result);
        }
    } else if (goal.includes("pricing")) {
        // Go to pricing if not there
        if (!url.includes('pricing')) await page.goto(`${CONFIG.baseUrl}/pricing`);
        await delay(2000);
        const ult = page.locator('button:has-text("Ultimate")').first();
        if (await ult.isVisible()) {
            await smartClick(page, ult);
            // Rage click simulation
            if (Math.random() > 0.5) await ult.click({ clickCount: 5, delay: 50 });
        }
    } else {
        // Default: Click a movie
        const movie = page.locator('.movie-card, img[alt*="Movie"]').nth(Math.floor(Math.random()*4));
        if (await movie.isVisible()) await smartClick(page, movie);
    }
}

// --- 4. MAIN CONTROLLER ---

async function getPageSnapshot(page: Page) {
    // Only scrape what's useful
    const elements = await page.$$('button, a, input, [role="button"], .movie-card, .avatar');
    const interactables: any[] = [];

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!(await el.isVisible().catch(()=>false))) continue;

        const text = await el.textContent().catch(()=>'') || '';
        const label = await el.getAttribute('aria-label').catch(()=>'') || '';
        const role = await el.getAttribute('role').catch(()=>'') || '';
        
        // Skip empty elements unless they are images/cards
        const isCard = (await el.getAttribute('class'))?.includes('movie-card');
        if (!text && !label && !isCard) continue;

        interactables.push({
            index: i,
            handle: el,
            description: `[${i}] ${isCard ? 'MOVIE_CARD' : 'EL'} Text:"${text.substring(0,30)}" Label:"${label}" Role:"${role}"`
        });
    }
    return interactables;
}

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
        
        const cookie = page.locator('button:has-text("Accept"), button:has-text("Allow")').first();
        if (await cookie.isVisible()) await cookie.click();
        await forcePostHog(page);

        // Login
        console.log(`🔐 Login: ${CURRENT_USER.email}`);
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', CURRENT_USER.email);
        await page.fill('input[type="password"]', CURRENT_USER.password);
        await page.click('button[type="submit"]');
        try { await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }); } catch(e) {}

        // GOAL LOOP
        const goals = [
            "If on profile screen, click a user avatar. If on dashboard, click a movie card to watch.",
            "Find and click the search button.",
            "Go to the pricing page and click the Ultimate plan.",
            "Click a movie poster to watch it.",
            "Explore the navigation menu."
        ];
        let goalIndex = 0;

        console.log('🎬 Starting Hybrid AI Loop...');

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now())/1000);
            const currentGoal = goals[goalIndex % goals.length];
            
            console.log(`\n--- Cycle (${remaining}s left) ---`);
            console.log(`   Goal: "${currentGoal}"`);

            // 1. Scrape
            const interactables = await getPageSnapshot(page);
            
            // 2. AI Decide
            const choiceIndex = await askGeminiAction(currentGoal, interactables);
            
            let success = false;
            if (choiceIndex !== -1) {
                const target = interactables.find(i => i.index === choiceIndex);
                if (target) {
                    console.log(`      🧠 AI Executing: ${target.description}`);
                    success = await smartClick(page, target.handle);
                    await delay(4000); // Wait for reaction
                }
            }

            // 3. Fallback if AI failed
            if (!success) {
                await runHeuristicFallback(page, currentGoal);
            }

            // 4. Watch Logic Check
            if (page.url().includes('watch')) {
                console.log('      📺 Watching video...');
                const duration = 30000 + Math.random() * 60000;
                const start = Date.now();
                while (Date.now() - start < duration) {
                    await delay(5000);
                    const x = Math.random() * 200;
                    await page.mouse.move(300+x, 300+x, { steps: 20 });
                }
                if (Math.random() > 0.5) await page.goBack();
            }

            await forcePostHog(page);
            
            // Change goal if we made progress, otherwise stick to it
            if (Math.random() > 0.3) goalIndex++;
        }

        console.log('✅ Session Complete. Final Flush...');
        // Hard wait for last chunks
        await delay(20000);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
