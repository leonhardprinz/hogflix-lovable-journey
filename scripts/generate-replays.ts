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

// Current user for this session
const CURRENT_USER = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 1. THE "EYES": DOM SCRAPER ---

interface Interactable {
    index: number;
    handle: ElementHandle;
    description: string;
}

/**
 * Scrapes all visible buttons, links, and inputs.
 * Returns them as a list of handles + a text description for the AI.
 */
async function getPageSnapshot(page: Page): Promise<Interactable[]> {
    // Select all potentially interactive elements
    const elements = await page.$$('button, a, input, textarea, [role="button"], video, .movie-card, .avatar');
    const interactables: Interactable[] = [];

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        // Check visibility efficiently
        const isVisible = await el.isVisible().catch(() => false);
        if (!isVisible) continue;

        // Get useful context
        const tagName = await el.evaluate(e => e.tagName.toLowerCase());
        const text = await el.textContent().catch(() => '') || '';
        const ariaLabel = await el.getAttribute('aria-label').catch(() => '') || '';
        const placeholder = await el.getAttribute('placeholder').catch(() => '') || '';
        const role = await el.getAttribute('role').catch(() => '') || '';
        
        // Clean up text
        const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 50);
        
        // Build description line
        let desc = `[${i}] <${tagName}>`;
        if (cleanText) desc += ` Text: "${cleanText}"`;
        if (ariaLabel) desc += ` Label: "${ariaLabel}"`;
        if (placeholder) desc += ` Placeholder: "${placeholder}"`;
        if (role) desc += ` Role: "${role}"`;

        interactables.push({ index: i, handle: el, description: desc });
    }
    
    return interactables;
}

// --- 2. THE "BRAIN": GEMINI DECIDER ---

async function askGeminiAction(goal: string, elements: Interactable[]): Promise<ElementHandle | null> {
    if (!CONFIG.geminiKey || elements.length === 0) return null;

    // Construct a prompt representing the screen
    const screenDump = elements.map(e => e.description).join('\n');
    
    const prompt = `
    I am a user testing a Netflix-style streaming app called HogFlix.
    MY CURRENT GOAL: "${goal}"
    
    Here is a list of interactive elements currently visible on my screen:
    ---
    ${screenDump}
    ---
    
    INSTRUCTIONS:
    1. Look for the element that best helps me achieve my goal.
    2. If I am on a Profile Selection screen, pick a user profile.
    3. If I am on the Dashboard, pick a movie or a nav link based on the goal.
    4. If I am watching a video and the goal is to leave, look for a back button.
    
    Reply ONLY with the Index Number (inside the []) of the single best element to click.
    If nothing is relevant, reply "-1".
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        console.log(`      🧠 AI Logic: Goal="${goal}" -> Choice="${response}"`);
        
        const chosenIndex = parseInt(response.match(/-?\d+/)?.[0] || '-1');
        
        if (chosenIndex !== -1) {
            const match = elements.find(e => e.index === chosenIndex);
            return match ? match.handle : null;
        }
    } catch (e) {
        console.log('      ⚠️ AI Error:', e.message);
    }
    return null;
}

// --- 3. THE "BODY": HUMAN PHYSICS ---

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

        targetX = Math.max(1, Math.min(targetX, 1279));
        targetY = Math.max(1, Math.min(targetY, 799));

        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        const steps = Math.max(25, Math.min(Math.floor(distance / 8), 80)); // Slow, deliberate steps

        await page.mouse.move(targetX, targetY, { steps });
        MOUSE_STATE = { x: targetX, y: targetY };
    } catch (e) { }
}

async function smartClick(page: Page, element: ElementHandle) {
    try {
        await humanMove(page, element);
        await delay(300 + Math.random() * 400); // Hesitation
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

// --- 4. JOURNEY EXECUTOR ---

async function runAutonomousCycle(page: Page, goal: string) {
    console.log(`   🤖 AI Agent Active. Goal: "${goal}"`);
    
    // 1. Scrape Screen
    const interactables = await getPageSnapshot(page);
    
    if (interactables.length === 0) {
        console.log('      -> Screen appears empty/loading. Waiting...');
        await delay(3000);
        return;
    }

    // 2. Ask AI
    const targetElement = await askGeminiAction(goal, interactables);

    // 3. Act
    if (targetElement) {
        await smartClick(page, targetElement);
        
        // 4. Post-Click Logic
        await delay(3000); // Wait for app to react
        
        // Special Case: If we clicked a "Video" or "Play", enter Watch Loop
        const isVideo = await page.evaluate(() => !!document.querySelector('video'));
        if (isVideo || page.url().includes('watch')) {
            await doWatchBehavior(page);
        }
    } else {
        console.log('      -> AI found nothing relevant. Scrolling/Exploring...');
        await page.mouse.wheel(0, 400);
        await delay(2000);
    }
}

async function doWatchBehavior(page: Page) {
    console.log('   📺 Entering Watch Mode...');
    // Ensure Playback
    await page.evaluate(() => {
        const v = document.querySelector('video');
        if (v) { v.muted = true; v.play(); }
    });

    // Watch for random time
    const duration = 40000 + Math.random() * 60000;
    const start = Date.now();
    
    while (Date.now() - start < duration) {
        await delay(5000);
        // Random mouse drift
        const x = Math.random() * 200;
        await page.mouse.move(300 + x, 300 + x, { steps: 40 });
    }
    
    console.log('      -> Leaving video.');
    await page.goBack();
    await delay(3000);
}

async function doLogin(page: Page) {
    console.log(`   🔐 Logging in as ${CURRENT_USER.email}`);
    await page.goto(`${CONFIG.baseUrl}/login`);
    await page.fill('input[type="email"]', CURRENT_USER.email);
    await page.fill('input[type="password"]', CURRENT_USER.password);
    await page.click('button[type="submit"]');
    try { await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }); } catch(e) {}
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
        await delay(3000);
        
        const cookie = page.locator('button:has-text("Accept"), button:has-text("Allow")').first();
        if (await cookie.isVisible()) await cookie.click();
        await forcePostHog(page);

        // 1. Login Phase
        await doLogin(page);

        // 2. The AI Loop
        // We rotate goals to keep the AI focused
        const goals = [
            "If I am on the profile screen, select a user. If on dashboard, browse movies.",
            "Find the search button and click it, or search for a sci-fi movie.",
            "Go to the pricing page and look at the Ultimate plan.",
            "Find a movie card and click it to watch."
        ];

        let goalIndex = 0;

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now())/1000);
            const currentGoal = goals[goalIndex % goals.length];
            
            console.log(`\n--- AI Cycle (${remaining}s left) ---`);
            
            // Run the AI decision engine
            await runAutonomousCycle(page, currentGoal);
            
            // Rotate goal every 2-3 cycles
            if (Math.random() > 0.6) goalIndex++;
            
            // Re-inject PostHog
            await forcePostHog(page);
            await delay(2000);
        }

        console.log('✅ Session Complete. Final Flush...');
        await delay(20000);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
