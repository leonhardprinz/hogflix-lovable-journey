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
    // Try both keys if available
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

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey || '');
// Use Flash for speed/cost, Pro as implicit fallback in logic if needed
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

let MOUSE_STATE = { x: 0, y: 0 };
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 2. PHYSICS & UTILS (The Body) ---

async function humanMove(page: Page, target: ElementHandle | { x: number, y: number }) {
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

        // Clamp
        targetX = Math.max(5, Math.min(targetX, 1275));
        targetY = Math.max(5, Math.min(targetY, 795));

        const distance = Math.hypot(targetX - MOUSE_STATE.x, targetY - MOUSE_STATE.y);
        // Slower movement for PostHog tracking (more steps)
        const steps = Math.max(40, Math.min(Math.floor(distance / 3), 120));

        await Promise.race([
            page.mouse.move(targetX, targetY, { steps }),
            delay(3000)
        ]);
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
            await delay(400 + Math.random() * 400);
            await element.click({ timeout: 3000 });
            return true;
        }
    } catch (e) { return false; }
    return false;
}

async function forcePostHog(page: Page) {
    try {
        await page.evaluate(() => {
            // @ts-ignore
            if (window.posthog) {
                // @ts-ignore
                window.posthog.opt_in_capturing();
                // @ts-ignore
                window.posthog.startSessionRecording();
            }
        });
    } catch (e) { }
}

// --- 3. THE BRAIN (AI Decision Engine) ---

// Scrapes the page for actionable elements
async function getPageSnapshot(page: Page) {
    // We include more elements now to give AI freedom
    // Added: img[alt], [data-testid], .play-icon, .card
    const elements = await page.$$('button, a, input, [role="button"], .movie-card, video, h1, h2, h3, img[alt], [data-testid], .play-icon');
    const interactables: any[] = [];
    const viewport = page.viewportSize();

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const box = await el.boundingBox();

        // Ignore tiny/invisible/off-screen (footer)
        if (!box || box.width < 10 || box.height < 10) continue;
        // if (viewport && box.y > viewport.height * 1.5) continue; 

        const text = await el.textContent().catch(() => '') || '';
        const label = await el.getAttribute('aria-label').catch(() => '') || '';
        const role = await el.getAttribute('role').catch(() => '') || '';
        const href = await el.getAttribute('href').catch(() => '') || '';
        const alt = await el.getAttribute('alt').catch(() => '') || '';
        const testId = await el.getAttribute('data-testid').catch(() => '') || '';
        const className = await el.getAttribute('class').catch(() => '') || '';

        const isCard = className.includes('movie-card') || className.includes('card');
        const isPlay = className.includes('play') || label.toLowerCase().includes('play') || text.toLowerCase().includes('play');

        // Filter noise
        if (!text.trim() && !label && !isCard && !href && !alt && !isPlay) continue;

        let type = "ELEMENT";
        if (isCard) type = "MOVIE_CARD";
        else if (isPlay) type = "PLAY_BUTTON";
        else if (href) type = "LINK";
        else if (text) type = "TEXT/BUTTON";

        interactables.push({
            index: i,
            handle: el,
            description: `[${i}] TYPE:${type} TEXT:"${text.substring(0, 40).replace(/\n/g, '')}" LABEL:"${label}" ALT:"${alt}" HREF:"${href}" TESTID:"${testId}"`
        });
    }
    return interactables;
}

async function askGeminiToDrive(page: Page, goal: string, interactables: any[]): Promise<number> {
    if (!CONFIG.geminiKey || interactables.length === 0) return -1;

    const prompt = `
    I am an autonomous user testing a video streaming site (HogFlix).
    CURRENT GOAL: "${goal}"
    
    Here are the interactive elements visible on my screen:
    ---
    ${interactables.map(i => i.description).join('\n')}
    ---
    
    INSTRUCTIONS:
    1. Analyze the GOAL and the ELEMENTS.
    2. Pick the SINGLE best element index [x] to click to advance the goal.
    3. If the goal is "Watch" and you see a MOVIE_CARD or Play button, click it.
    4. If the goal is "Pricing" and you see a "Pricing" link, click it.
    5. If the goal is "Search" and you see a search icon, click it.
    6. Reply ONLY with the index number (e.g., 5). If nothing works, reply -1.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const idx = parseInt(text.match(/-?\d+/)?.[0] || '-1');
        return isNaN(idx) ? -1 : idx;
    } catch (e) { return -1; }
}

// --- 4. NAVIGATION HELPERS (The Bouncer) ---

async function ensureDashboard(page: Page) {
    // 1. Handle Profile Gate (Hard-coded Safety Net)
    if (page.url().includes('profiles') || await page.locator('text=Who’s Watching?').count() > 0) {
        console.log('      -> 🛑 Profile Gate detected.');

        // Try multiple selectors for the profile
        const selectors = [
            '[data-testid="profile-card"]',
            '.avatar',
            'text="CLICK TO START"',
            'div:has-text("CLICK TO START")'
        ];

        for (const sel of selectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible()) {
                console.log(`      -> Clicking profile selector: ${sel}`);
                await el.click({ force: true });
                // Wait for navigation or for profile gate to disappear
                try {
                    await page.waitForURL(u => !u.toString().includes('profiles'), { timeout: 3000 });
                    console.log('      ✅ Profile Gate passed.');
                    return;
                } catch (e) {
                    console.log('      ⚠️ Click didn\'t navigate. Trying next...');
                }
            }
        }

        // If still here, try reload
        console.log('      ⚠️ Profile Gate stuck. Reloading...');
        await page.reload();
    }
}

// --- 5. JOURNEY EXECUTORS (AI Guided) ---

// Generic AI Driver for navigation tasks
async function aiDriveJourney(page: Page, goal: string) {
    console.log(`   🤖 AI DRIVING: "${goal}"`);

    // 1. Look at screen
    const elements = await getPageSnapshot(page);

    // 2. Ask AI
    const choiceIndex = await askGeminiToDrive(page, goal, elements);

    if (choiceIndex !== -1) {
        const target = elements.find(e => e.index === choiceIndex);
        if (target) {
            console.log(`      🧠 AI Decision: Clicked ${target.description}`);
            await smartClick(page, target.handle);
            await delay(3000); // Wait for reaction
            return true;
        }
    }

    console.log('      🤔 AI unsure. trying random interaction...');
    // Fallback: Scroll or random click to unstick
    await page.mouse.wheel(0, 400);
    return false;
}

async function journeyWatchWithAI(page: Page) {
    console.log('   📺 JOURNEY: Watch Content');
    await ensureDashboard(page);

    // 1. Get to Video (AI Driven)
    if (!page.url().includes('watch')) {
        // Ask AI to find a movie
        const success = await aiDriveJourney(page, "Find a movie card or play button and click it to watch.");

        // If AI failed, fallback to manual
        if (!success) {
            console.log('      ⚠️ AI failed to find movie. Trying manual fallback...');

            // 1. Try Hero Play Button
            const heroPlay = page.locator('button:has-text("Play"), [aria-label="Play"], .hero-play-button').first();
            if (await heroPlay.isVisible()) {
                console.log('      -> Clicking Hero Play button');
                const h = await heroPlay.elementHandle();
                if (h) await smartClick(page, h);
            } else {
                // 2. Try any movie card
                const card = page.locator('.movie-card, [data-testid="movie-card"], a[href^="/watch"]').first();
                if (await card.isVisible()) {
                    console.log('      -> Clicking Movie Card fallback');
                    const h = await card.elementHandle();
                    if (h) {
                        await smartClick(page, h);
                        // NEW: Wait for potential modal and click Play inside it
                        await delay(2000);
                        const modalPlay = page.locator('button:has-text("Play"), [aria-label="Play"]').first();
                        if (await modalPlay.isVisible()) {
                            console.log('      -> Clicking Play in Modal');
                            const mh = await modalPlay.elementHandle();
                            if (mh) await smartClick(page, mh);
                        }
                    }
                } else {
                    // 3. Last resort: click any image that looks like a poster
                    const poster = page.locator('img[alt*="poster"], img[class*="card"]').first();
                    if (await poster.isVisible()) {
                        console.log('      -> Clicking Image fallback');
                        const h = await poster.elementHandle();
                        if (h) await smartClick(page, h);
                    }
                }
            }
        }

        try { await page.waitForURL(/.*watch.*/, { timeout: 8000 }); } catch (e) { }
    }

    // 2. Watch Loop (Hardcoded because watching is passive)
    console.log('      -> Checking player...');
    const video = page.locator('video').first();

    try { await video.waitFor({ timeout: 4000 }); } catch (e) {
        console.log('      ⚠️ Waking up player...');
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width / 2, vp.height / 2);
    }

    const isPlaying = await page.evaluate(async () => {
        const v = document.querySelector('video');
        if (!v) return false;
        v.muted = true;
        try { await v.play(); return true; } catch (e) { return false; }
    });

    if (isPlaying) {
        const duration = 30000 + Math.random() * 90000;
        console.log(`      -> Watching for ${(duration / 1000).toFixed(0)}s`);
        const start = Date.now();
        while (Date.now() - start < duration) {
            await delay(5000);
            const x = Math.random() * 300;
            try { await page.mouse.move(300 + x, 300 + x, { steps: 25 }); } catch (e) { }
        }
        console.log('      -> Done. Going back.');
        await page.goBack();
    } else {
        console.log('      ⚠️ Playback failed.');
        await page.goto(`${CONFIG.baseUrl}/browse`);
    }
}

async function journeySearchWithAI(page: Page) {
    console.log('   🔍 JOURNEY: Search');
    await ensureDashboard(page);

    // 1. Ask AI to find search
    await aiDriveJourney(page, "Find the search icon or search bar and click it.");

    // 2. Type Query (Manual because Playwright typing is better)
    const term = ["Hog", "Sci-Fi", "Space", "Comedy"][Math.floor(Math.random() * 4)];
    console.log(`      -> Typing "${term}"...`);
    await page.keyboard.type(term, { delay: 100 });
    await delay(500);
    await page.keyboard.press('Enter');
    await delay(3000);

    // 3. Ask AI to pick result
    await aiDriveJourney(page, `Click the best movie result for "${term}"`);
}

async function journeyRageClickUltimate(page: Page) {
    console.log('   🔥 JOURNEY: Rage Click Ultimate Plan');
    await ensureDashboard(page);

    // Navigate to pricing
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(2000);

    // Find Ultimate button with multiple fallback selectors
    const ultimateBtn = page.locator(
        'button:has-text("Ultimate"), button:has-text("ultimate"), [data-plan="ultimate"], button:has-text("ULTIMATE")'
    ).first();

    if (await ultimateBtn.isVisible()) {
        console.log('      -> Starting realistic rage click sequence...');

        // CRITICAL: Scroll into view so session replay sees it
        await ultimateBtn.scrollIntoViewIfNeeded();
        await delay(1000); // Wait for scroll to settle

        // Track rage click start
        await page.evaluate(() => {
            if ((window as any).posthog) {
                (window as any).posthog.capture('rage_click_started', {
                    button: 'ultimate_plan',
                    page: '/pricing'
                });
            }
        });

        const clickCount = 5 + Math.floor(Math.random() * 7); // 5-12 clicks
        const box = await ultimateBtn.boundingBox();

        if (box) {
            for (let i = 0; i < clickCount; i++) {
                // Add jitter to mouse position
                const jitterX = (Math.random() - 0.5) * 20;
                const jitterY = (Math.random() - 0.5) * 20;
                const clickX = box.x + box.width / 2 + jitterX;
                const clickY = box.y + box.height / 2 + jitterY;

                await page.mouse.click(clickX, clickY);

                // Track each click
                await page.evaluate((clickNum) => {
                    if ((window as any).posthog) {
                        (window as any).posthog.capture('rage_click_attempt', {
                            button: 'ultimate_plan',
                            click_number: clickNum
                        });
                    }
                }, i + 1);

                // Variable delay - faster as frustration builds
                const baseDelay = 200 - (i * 15); // Start 200ms, decrease to 50ms
                const delayMs = Math.max(50, baseDelay + Math.random() * 50);
                await delay(delayMs);

                // After 3 clicks, pause (user thinking "why isn't this working?")
                if (i === 2) {
                    await delay(500 + Math.random() * 500);
                }
            }

            // Track abandonment
            await page.evaluate((total) => {
                if ((window as any).posthog) {
                    (window as any).posthog.capture('rage_click_abandoned', {
                        button: 'ultimate_plan',
                        total_clicks: total
                    });
                }
            }, clickCount);

            console.log(`      ✅ Rage clicked ${clickCount} times with realistic pattern`);
        }
    } else {
        console.log('      ⚠️ Ultimate button not found');
    }

    await delay(2000);
}

async function journeyPricingWithAI(page: Page) {
    console.log('   💳 JOURNEY: Pricing');
    await ensureDashboard(page);

    // 1. Ask AI to find Pricing
    await aiDriveJourney(page, "Navigate to the Pricing or Subscription page.");
    await delay(2000);

    // 2. Use dedicated rage click function
    await journeyRageClickUltimate(page);

    // 3. Ask AI to subscribe to another plan
    await aiDriveJourney(page, "Click the Subscribe button for the Standard plan.");

    // 4. Handle Checkout Form (Manual because it's sensitive)
    await delay(2000);
    if (await page.locator('input[placeholder*="Card"]').isVisible()) {
        console.log('      -> Filling Fake Card...');
        await page.fill('input[placeholder*="Card"]', '4242424242424242');
        await page.fill('input[placeholder*="MM/YY"]', '12/25');
        await page.fill('input[placeholder*="CVC"]', '123');
        await delay(1000);
        const pay = page.locator('button:has-text("Pay"), button:has-text("Subscribe")').last();
        if (await pay.isVisible()) await smartClick(page, await pay.elementHandle());
    }
}

// --- 6. MAIN ---

(async () => {
    // VISUAL MODE: headless: false
    const browser = await chromium.launch({ headless: true, slowMo: 50 });
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
        try { await page.waitForURL(/.*browse|.*profiles/, { timeout: 10000 }); } catch (e) { }

        // LOOP
        let cycle = 1;
        while (Date.now() < sessionEndTime) {
            const remaining = Math.ceil((sessionEndTime - Date.now()) / 1000);
            console.log(`\n--- Cycle #${cycle} (${remaining}s left) ---`);

            await ensureDashboard(page);

            const roll = Math.random();
            try {
                // 40% Watch, 25% Search, 35% Pricing (increased for more rage click data)
                if (roll < 0.35) await journeyPricingWithAI(page);
                else if (roll < 0.60) await journeySearchWithAI(page);
                else await journeyWatchWithAI(page);
            } catch (e) {
                console.log('   ⚠️ Journey Error:', (e as Error).message?.substring(0, 50));
                await page.goto(`${CONFIG.baseUrl}/browse`);
            }

            console.log('   ...transitioning...');
            await page.mouse.wheel(0, 400);
            await delay(3000);
            await forcePostHog(page);
            cycle++;
        }

        console.log('✅ Session Complete. Flushing...');

        // Fixed flush logic
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const ph = (window as any).posthog;
                if (ph && ph.sessionRecording) {
                    if (typeof ph.sessionRecording.flush === 'function') {
                        ph.sessionRecording.flush();
                    }
                    // Wait a bit for flush to happen
                    setTimeout(resolve, 3000);
                } else {
                    resolve(undefined);
                }
            });
        });

        await delay(5000);

    } catch (e) {
        console.error('❌ Fatal Error:', e);
    } finally {
        await browser.close();
    }
})();
