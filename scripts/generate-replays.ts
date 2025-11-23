import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    minSessionDuration: 300000, // 5 Minutes
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

// Init AI
const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

let MOUSE_STATE = { x: 0, y: 0 };
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 1. PERCEPTION SYSTEM (The Eyes) ---

interface Interactable {
    index: number;
    handle: ElementHandle;
    desc: string;
    type: string;
}

async function scanPage(page: Page): Promise<Interactable[]> {
    // Select meaningful elements. We exclude footer items if we can to keep focus.
    const selector = 'button, a, input, [role="button"], .movie-card, video, h1, h2';
    const elements = await page.$$(selector);
    const interactables: Interactable[] = [];
    const viewport = page.viewportSize();

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const box = await el.boundingBox();
        
        // Filter: Visible & In Viewport (mostly)
        if (!box || box.width < 5 || box.height < 5) continue;
        
        // Get semantic info
        const text = (await el.textContent())?.trim().replace(/\s+/g, ' ').substring(0, 50) || '';
        const label = await el.getAttribute('aria-label') || '';
        const placeholder = await el.getAttribute('placeholder') || '';
        const role = await el.evaluate(e => e.tagName.toLowerCase());
        const isCard = (await el.getAttribute('class'))?.includes('movie-card');
        
        // Semantic Filter: Ignore empty divs unless they look like movie cards
        if (!text && !label && !placeholder && !isCard && role !== 'video') continue;

        // Build description for AI
        let desc = `<${role}>`;
        if (text) desc += ` "${text}"`;
        if (label) desc += ` [Label: ${label}]`;
        if (placeholder) desc += ` [Input: ${placeholder}]`;
        if (isCard) desc += ` [TYPE: MOVIE_CARD]`;
        if (role === 'video') desc += ` [TYPE: VIDEO_PLAYER]`;

        interactables.push({ index: i, handle: el, desc, type: role });
    }
    
    // Limit to top 30 elements to avoid overwhelming AI context window
    return interactables.slice(0, 30);
}

// --- 2. DECISION ENGINE (The Brain) ---

async function decideNextAction(goal: string, elements: Interactable[], history: string[]) {
    if (!CONFIG.geminiKey) return null;

    const prompt = `
    I am simulating a human user on a Netflix-like streaming site.
    CURRENT GOAL: ${goal}
    
    RECENT HISTORY: ${history.join(' -> ')}
    
    VISIBLE ELEMENTS:
    ${elements.map(e => `${e.index}: ${e.desc}`).join('\n')}
    
    INSTRUCTIONS:
    1. Pick the SINGLE best element index to interact with to advance the goal.
    2. If the goal is "Watch", look for movie cards or play buttons.
    3. If the goal is "Search", look for search icons or inputs.
    4. If on a "Who's Watching" profile screen, ALWAYS pick a profile/avatar.
    5. If nothing is relevant, reply "-1" to trigger scrolling.
    
    RESPONSE FORMAT (JSON ONLY):
    { "index": number, "reason": "short explanation" }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        return { index: -1, reason: "AI Error" };
    }
}

// --- 3. ORGANIC ACTUATION (The Body) ---

async function organicMove(page: Page, target: ElementHandle) {
    try {
        const box = await target.boundingBox();
        if (!box) return;

        // Human jitter: don't click dead center
        const x = box.x + (box.width * (0.2 + Math.random() * 0.6));
        const y = box.y + (box.height * (0.2 + Math.random() * 0.6));

        // Fitts's Law Movement
        const start = MOUSE_STATE;
        const dist = Math.hypot(x - start.x, y - start.y);
        const steps = Math.min(100, Math.max(30, Math.floor(dist / 5))); // Slower steps

        await page.mouse.move(x, y, { steps });
        MOUSE_STATE = { x, y };
    } catch (e) {}
}

async function organicClick(page: Page, element: ElementHandle, isRage = false) {
    try {
        await organicMove(page, element);
        
        // Human hesitation (reading tooltip, thinking)
        await delay(300 + Math.random() * 600);
        
        if (isRage) {
            console.log('      😡 Rage clicking...');
            await element.click({ clickCount: 5, delay: 80 });
        } else {
            await element.click();
        }
        return true;
    } catch (e) { return false; }
}

async function organicType(page: Page, text: string) {
    for (const char of text) {
        await page.keyboard.type(char);
        await delay(50 + Math.random() * 100); // Variable typing speed
    }
    await delay(500);
    await page.keyboard.press('Enter');
}

async function organicWatch(page: Page) {
    console.log('      🍿 Entering "Human Watch" Mode...');
    
    // 1. Check if video is playing
    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        if (v.paused) { v.muted = true; await v.play().catch(() => {}); }
        return !v.paused;
    });

    if (!isPlaying) {
        console.log('      ⚠️ Video not playing. Trying center click...');
        const vp = page.viewportSize();
        if (vp) {
            await page.mouse.move(vp.width/2, vp.height/2, { steps: 30 });
            await page.mouse.click(vp.width/2, vp.height/2);
        }
    }

    // 2. Watch duration (Variable)
    const duration = 45000 + Math.random() * 120000; // 45s to 3m
    const end = Date.now() + duration;
    
    while (Date.now() < end) {
        await delay(5000);
        // Micro-movements to keep session alive (like checking time)
        const x = Math.random() * 200;
        await page.mouse.move(300 + x, 300 + x, { steps: 20 });
        
        // 10% Chance to pause/resume
        if (Math.random() < 0.1) {
            console.log('      ⏸️ User paused video...');
            await page.keyboard.press('Space');
            await delay(3000 + Math.random() * 5000);
            await page.keyboard.press('Space');
        }
    }
    
    console.log('      🔙 Bored now. Going back.');
    await page.goBack();
}

// --- 4. MAIN LOOP ---

async function forcePostHog(page: Page) {
    await page.evaluate(() => {
        // @ts-ignore
        if (window.posthog) { window.posthog.opt_in_capturing(); window.posthog.startSessionRecording(); }
    });
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
        await delay(3000);
        await forcePostHog(page);

        // --- LOGIN (Hardcoded because it's security, not exploration) ---
        const user = CONFIG.users[Math.floor(Math.random() * CONFIG.users.length)];
        console.log(`🔐 Login: ${user.email}`);
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[type="email"]', user.email);
        await page.fill('input[type="password"]', user.password);
        await page.click('button[type="submit"]');
        await delay(5000); // Wait for auth redirect

        // --- AUTONOMOUS LOOP ---
        const goals = [
            "Pass the profile selection screen if visible.",
            "Browse the dashboard and click a movie to watch.",
            "Find the search bar, search for 'Sci-Fi' or 'Comedy', and click a result.",
            "Go to the Pricing page and rage-click the Ultimate plan button.",
            "Watch whatever video is on screen."
        ];
        
        // We keep a short history to give context to the AI
        let actionHistory: string[] = ["Logged in"];
        let activeGoal = goals[0]; // Start with Profile check

        console.log('🧠 AI Agent Started. Exploring...');

        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n⏱️ ${remaining}s left. Goal: "${activeGoal}"`);

            // 1. Check for special states (Video / Profile)
            const url = page.url();
            const interactables = await scanPage(page);

            // Special Case: Profile Screen (Priority 1)
            if (url.includes('profile') || interactables.some(i => i.desc.includes('Who’s Watching'))) {
                activeGoal = "Pass the profile selection screen.";
            }
            // Special Case: Video Player (Priority 1)
            else if (url.includes('watch')) {
                await organicWatch(page);
                activeGoal = "Browse the dashboard and click a movie to watch."; // Reset goal after watching
                continue;
            }

            // 2. Ask AI what to do
            const decision = await decideNextAction(activeGoal, interactables, actionHistory);
            
            if (decision && decision.index !== -1) {
                const target = interactables.find(i => i.index === decision.index);
                if (target) {
                    console.log(`   👉 AI Action: Clicked ${target.desc} (${decision.reason})`);
                    
                    // Check for special actions
                    if (target.desc.includes('Search') || target.desc.includes('Input')) {
                        await organicClick(page, target.handle);
                        const terms = ["Hog", "Space", "Comedy", "Adventure"];
                        const term = terms[Math.floor(Math.random()*terms.length)];
                        await organicType(page, term);
                    } 
                    else if (target.desc.includes('Ultimate') && activeGoal.includes('Pricing')) {
                        await organicClick(page, target.handle, true); // Rage click
                    }
                    else {
                        await organicClick(page, target.handle);
                    }
                    
                    actionHistory.push(`Clicked ${target.desc.substring(0,20)}`);
                    if (actionHistory.length > 5) actionHistory.shift();
                    
                    // If we successfully clicked something relevant, maybe switch goals?
                    if (Math.random() > 0.6) {
                        activeGoal = goals[Math.floor(Math.random() * goals.length)];
                    }
                }
            } else {
                console.log('   🤔 AI found nothing relevant. Scrolling...');
                await page.mouse.wheel(0, 500);
                // If stuck, force a goal switch
                if (Math.random() > 0.5) activeGoal = goals[Math.floor(Math.random() * goals.length)];
            }

            await delay(4000);
            await forcePostHog(page);
        }

        console.log('✅ Session Complete.');
        await delay(15000); // Flush buffer

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
})();
