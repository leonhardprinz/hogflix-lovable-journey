import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

chromium.use(stealthPlugin());

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 👥 USER POOL
const USERS = [
    { email: 'summers.nor-7f@icloud.com',  password: 'zug2vec5ZBE.dkq*ubk' },
    { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
    { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' }
];

const CURRENT_USER = USERS[Math.floor(Math.random() * USERS.length)];

// --- AI BRAIN ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function askGeminiDecider(page: Page, context: string, elements: {text: string, index: number}[]) {
    if (!GEMINI_API_KEY) return null;
    
    try {
        // Limit token usage
        const limitedElements = elements.slice(0, 8);
        const prompt = `Context: ${context}. Options:\n${limitedElements.map(e => `${e.index}. ${e.text}`).join('\n')}\nReply ONLY with the index number.`;
        
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        const index = parseInt(response);
        
        if (!isNaN(index)) return index;
        return null;
    } catch (e) {
        return null;
    }
}

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function humanMove(page: Page, selectorOrEl: string | ElementHandle) {
    let element;
    if (typeof selectorOrEl === 'string') {
        element = page.locator(selectorOrEl).first();
        if (await element.count() === 0) return;
    } else {
        element = selectorOrEl;
    }
    // @ts-ignore
    const box = await element.boundingBox();
    if (!box) return;

    const targetX = box.x + (box.width / 2) + (Math.random() * 20 - 10);
    const targetY = box.y + (box.height / 2) + (Math.random() * 20 - 10);
    await page.mouse.move(targetX, targetY, { steps: 35 });
}

async function forcePostHogStart(page: Page) {
    await page.evaluate(() => {
        // @ts-ignore
        if (window.posthog) {
            // @ts-ignore
            window.posthog.register({ $device_type: 'Desktop', $browser: 'Chrome' });
            // @ts-ignore
            window.posthog.opt_in_capturing();
            // @ts-ignore
            window.posthog.startSessionRecording();
        }
    });
}

// --- ACTIONS ---

async function doLogin(page: Page) {
    console.log(`   🔐 Login as ${CURRENT_USER.email}`);
    await humanMove(page, 'input[type="email"]');
    await page.fill('input[type="email"], input[name="email"]', CURRENT_USER.email);
    await delay(300);
    await humanMove(page, 'input[type="password"]');
    await page.fill('input[type="password"]', CURRENT_USER.password);
    
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.isVisible()) {
        await humanMove(page, await btn.elementHandle());
        await btn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    await delay(4000);
}

async function doProfileSelection(page: Page) {
    console.log('   👥 Selecting Profile...');
    const userText = page.locator(`text=${CURRENT_USER.email.split('@')[0]}`).first();
    const avatar = page.locator('.avatar, img[alt*="profile"]').first();
    
    if (await userText.isVisible()) {
        await humanMove(page, await userText.elementHandle());
        await userText.click();
    } else if (await avatar.isVisible()) {
        await humanMove(page, await avatar.elementHandle());
        await avatar.click();
    } else {
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
    }
    await delay(4000);
}

async function doBrowse(page: Page) {
    console.log('   🍿 DASHBOARD: Browsing...');

    // 1. Gather Clickables
    // Use a more specific selector for the "Play" part of the card if possible
    let candidates = await page.locator('.movie-card').all();
    if (candidates.length === 0) candidates = await page.locator('img[alt*="Movie"]').all();
    
    // 2. AI Decision
    let selectedIndex = -1;
    if (candidates.length > 0) {
        const optionsData = [];
        for (let i = 0; i < Math.min(candidates.length, 5); i++) {
            const text = await candidates[i].textContent() || "Movie";
            optionsData.push({ text: text.trim().substring(0,30), index: i });
        }
        selectedIndex = await askGeminiDecider(page, "Pick a movie", optionsData) || -1;
    }

    // Fallback
    if (selectedIndex === -1 && candidates.length > 0) {
        selectedIndex = Math.floor(Math.random() * candidates.length);
    }

    // 3. EXECUTE & VERIFY
    if (selectedIndex !== -1) {
        const target = candidates[selectedIndex];
        await target.scrollIntoViewIfNeeded();
        await humanMove(page, target);
        await delay(500);
        await target.click();
        
        console.log('      -> Clicked movie. Waiting for navigation...');
        
        // 🆕 THE FIX: Wait for URL to actually change
        try {
            // Wait up to 5 seconds to see if we enter watch mode
            await page.waitForURL(/.*watch.*/, { timeout: 5000 });
            console.log('      ✅ Navigation successful!');
        } catch(e) {
            console.log('      ⚠️ Navigation failed (or Modal opened). Checking for Play button...');
            // Check for Modal Play button
            const modalPlay = page.locator('button:has-text("Play"), button[aria-label="Play"]').first();
            if (await modalPlay.isVisible()) {
                await humanMove(page, modalPlay);
                await modalPlay.click();
                await page.waitForURL(/.*watch.*/, { timeout: 5000 }).catch(() => {});
            }
        }
    } else {
        console.log('      -> No interactables found. Scrolling.');
        await page.mouse.wheel(0, 500);
    }
}

async function doWatch(page: Page) {
    const percentages = [0.30, 0.50, 0.80];
    const targetPercent = percentages[Math.floor(Math.random() * percentages.length)];
    const watchMs = 40000 * targetPercent; // 40s base
    
    console.log(`   📺 WATCHING: Target ${(targetPercent*100)}% (${watchMs/1000}s)`);

    const video = page.locator('video').first();
    try { 
        await video.waitFor({ timeout: 8000 }); 
        // Wait for actual playback
        await page.waitForFunction(() => {
            const v = document.querySelector('video');
            return v && v.readyState >= 2 && !v.paused;
        }, { timeout: 8000 });
    } catch(e) {
        console.log('      ⚠️ Video stalled. Clicking center...');
        const box = await video.boundingBox();
        if (box) await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    }

    const startTime = Date.now();
    while (Date.now() - startTime < watchMs) {
        await delay(2000);
        // 🆕 Keep-Alive Jitter
        const x = Math.random() * 200;
        await page.mouse.move(300 + x, 300 + x, { steps: 10 });
    }
    
    console.log('      -> Done watching. Back.');
    await page.goBack();
    await delay(3000);
}

async function detectState(page: Page) {
    const url = page.url();
    if (url.includes('login')) return 'AUTH';
    if (url.includes('profiles')) return 'PROFILES';
    if (url.includes('watch')) return 'WATCHING';
    
    if (await page.locator('input[type="password"]').count() > 0) return 'AUTH';
    if (await page.locator('.movie-card, nav').count() > 0) return 'DASHBOARD';
    
    return 'UNKNOWN';
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
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
  
  const page = await context.newPage();
  
  // Spy on PostHog Packets
  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') {
         // console.log(`   📡 Sending REPLAY Chunk (${req.postData()?.length} bytes)`);
      }
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    await forcePostHogStart(page);

    const maxSteps = 12;
    for (let step = 0; step < maxSteps; step++) {
        const state = await detectState(page);
        console.log(`🔄 Step ${step+1}: [${state}]`);
        
        switch (state) {
            case 'AUTH': await doLogin(page); break;
            case 'PROFILES': await doProfileSelection(page); break;
            case 'DASHBOARD': await doBrowse(page); break;
            case 'WATCHING': await doWatch(page); break;
            case 'UNKNOWN':
                const login = page.locator('button:has-text("Sign in")').first();
                if (await login.isVisible()) await login.click();
                else await page.mouse.wheel(0, 500);
                break;
        }
        
        if (step % 2 === 0) await forcePostHogStart(page);
        await delay(2000);
    }

    console.log('⏳ Session Complete. Waiting for final PostHog flush...');
    
    // 🆕 Final Flush Wait Strategy
    // Wait for a successful upload, OR 20 seconds max
    try {
        const flushPromise = page.waitForResponse(resp => 
            resp.url().includes('/s/') && resp.status() === 200, 
            { timeout: 20000 }
        );
        await Promise.race([flushPromise, delay(20000)]);
        console.log('   ✅ Final data flushed!');
    } catch(e) {
        console.log('   ⚠️ Flush timeout (continuing).');
    }

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
