import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- CONFIG ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes
    // Use the NEW key variable
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

const CURRENT_USER = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 1. AI ENGINE (Updated Models) ---

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');

// UPDATED: Use the models from your screenshot
const MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-1.5-flash"];

async function askGeminiAction(goal: string, elements: any[]): Promise<number> {
    if (!CONFIG.geminiKey) return -1;

    // Summarize screen for AI (Limit to top 15 elements to save tokens)
    const screenDump = elements.slice(0, 15).map(e => e.description).join('\n');
    
    const prompt = `
    GOAL: "${goal}"
    SCREEN ELEMENTS:
    ${screenDump}
    
    INSTRUCTIONS:
    - Return ONLY the index number [x] of the best element to click.
    - If on a Profile screen (images/avatars), ALWAYS pick one.
    - If watching a video, pick nothing (-1) or a back button.
    - If nothing fits, return -1.
    `;

    for (const modelName of MODELS_TO_TRY) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = result.response.text().trim();
            
            const match = response.match(/\d+/);
            if (match) return parseInt(match[0]);
            return -1;

        } catch (e: any) {
            // If 404 or Quota, try next model
            if (e.message?.includes('404') || e.message?.includes('429')) {
                console.log(`      ⚠️ ${modelName} failed/limited. Trying next...`);
                continue; 
            }
            console.log('      ⚠️ AI Error:', e.message.substring(0, 50));
            break; 
        }
    }
    return -1;
}

// --- 2. PHYSICS ENGINE ---

let MOUSE_STATE = { x: 0, y: 0 };

async function humanMove(page: Page, target: ElementHandle | {x: number, y: number}) {
    try {
        let targetX = 0, targetY = 0;

        if ('boundingBox' in target) {
            const box = await target.boundingBox();
            if (!box) return;
            // Organic offset
            targetX = box.x + (box.width / 2) + (Math.random() * 20 - 10);
            targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
        } else {
            targetX = target.x;
            targetY = target.y;
        }

        // Clamp to viewport
        targetX = Math.max(5, Math.min(targetX, 1275));
        targetY = Math.max(5, Math.min(targetY, 795));

        // Fitts's Law Speed
        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        const steps = Math.max(25, Math.min(Math.floor(distance / 8), 60));

        await page.mouse.move(targetX, targetY, { steps });
        MOUSE_STATE = { x: targetX, y: targetY };
    } catch (e) { }
}

async function smartClick(page: Page, element: ElementHandle) {
    try {
        await humanMove(page, element);
        await delay(300 + Math.random() * 300);
        await element.click();
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

// --- 3. FALLBACK BRAIN (Heuristic) ---

async function runHeuristicFallback(page: Page, goal: string) {
    console.log('      🧩 Heuristic Fallback (AI skipped)...');
    const url = page.url();

    // 1. Stuck on Profile? (Aggressive Check)
    if (url.includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0) {
        console.log('         -> Selecting Profile (Fallback)');
        // Click ANYTHING that looks like an avatar
        const avatar = page.locator('.avatar, img[alt*="profile"], .profile-card').first();
        if (await avatar.isVisible()) await smartClick(page, avatar);
        return;
    }

    // 2. Watch Behavior
    if (goal.includes("watch") || url.includes("watch")) {
        console.log('         -> Force Playing...');
        // Blind click center to wake up custom players
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
        
        // JS Force
        await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v) { v.muted = true; v.play(); }
        });
        return;
    }

    // 3. Search
    if (goal.includes("search")) {
        const searchBtn = page.locator('button[aria-label="Search"], .lucide-search, a[href="/search"]').first();
        if (await searchBtn.isVisible()) {
            await smartClick(page, searchBtn);
            await delay(1000);
            await page.keyboard.type("sci-fi", { delay: 150 });
            await delay(2000);
            await page.keyboard.press('Enter');
        }
    }
    
    // 4. Pricing
    else if (goal.includes("pricing")) {
        if (!url.includes('pricing')) await page.goto(`${CONFIG.baseUrl}/pricing`);
        await delay(2000);
        const ult = page.locator('button:has-text("Ultimate")').first();
        if (await ult.isVisible()) await smartClick(page, ult);
    } 
    
    // 5. Browse
    else {
        const movie = page.locator('.movie-card, img[alt*="Movie"]').nth(Math.floor(Math.random()*4));
        if (await movie.isVisible()) await smartClick(page, movie);
    }
}

// --- 4. DOM SCRAPER ---

async function getPageSnapshot(page: Page) {
    const elements = await page.$$('button, a, input, [role="button"], .movie-card, .avatar, video');
    const interactables: any[] = [];

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!(await el.isVisible().catch(()=>false))) continue;

        const text = await el.textContent().catch(()=>'') || '';
        const label = await el.getAttribute('aria-label').catch(()=>'') || '';
        const role = await el.getAttribute('role').catch(()=>'') || '';
        const src = await el.getAttribute('src').catch(()=>'') || '';
        
        // Filter noise
        if (!text && !label && !role && !src) continue;

        interactables.push({
            index: i,
            handle: el,
            description: `[${i}] Text:"${text.substring(0,30)}" Label:"${label}" Role:"${role}"`
        });
    }
    return interactables;
}

// --- MAIN ---

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

        // GOALS
        const goals = [
            "If on profile screen, click a user avatar. If on dashboard, click a movie card.",
            "Find search button, click it, type 'Hog', click result.",
            "Go to pricing page, find Ultimate plan, rage click it.",
            "Find a movie poster, click it, then watch the video.",
            "Explore navigation links."
        ];
        let goalIndex = 0;

        console.log('🎬 Starting AI Journey Loop...');

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
                    await delay(4000);
                }
            }

            // 3. Fallback
            if (!success) {
                await runHeuristicFallback(page, currentGoal);
            }

            // 4. Watch Logic (Universal)
            if (page.url().includes('watch')) {
                console.log('      📺 Watching...');
                // Force Play (Center click + JS)
                const vp = page.viewportSize();
                if (vp) await page.mouse.click(vp.width/2, vp.height/2);
                
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
            if (Math.random() > 0.2) goalIndex++; // Move to next goal
        }

        console.log('✅ Session Complete. Final Flush...');
        await delay(20000);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
