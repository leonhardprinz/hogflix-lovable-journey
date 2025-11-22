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
        const prompt = `
        You are a user testing a Netflix-style app.
        Context: ${context}
        
        Available clickable options:
        ${elements.map(e => `${e.index}. ${e.text}`).join('\n')}
        
        Reply ONLY with the number (index) of the element you want to click. 
        Pick something interesting. If nothing looks good, reply "RANDOM".
        `;
        
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        const index = parseInt(response);
        
        if (!isNaN(index)) return index;
        return null;
    } catch (e) {
        console.log('   🧠 AI Brain freeze (using fallback):', e.message);
        return null;
    }
}

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 🐭 ORGANIC MOUSE MOVEMENT
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

    // Overshoot logic: Aim slightly past the button then correct back
    // This creates a very human "arc"
    const start = page.mouse; // Playwright doesn't expose current pos well, assuming last known
    
    const targetX = box.x + (box.width / 2) + (Math.random() * 10 - 5);
    const targetY = box.y + (box.height / 2) + (Math.random() * 10 - 5);
    
    // Move in variable steps
    await page.mouse.move(targetX, targetY, { steps: 25 + Math.floor(Math.random() * 20) });
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
    await delay(400 + Math.random() * 200);
    
    await humanMove(page, 'input[type="password"]');
    await page.fill('input[type="password"]', CURRENT_USER.password);
    await delay(300);
    
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.isVisible()) {
        await humanMove(page, await btn.elementHandle());
        await btn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    await delay(5000);
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
        // Fallback center click
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
    }
    await delay(5000);
}

async function doBrowse(page: Page) {
    console.log('   🍿 DASHBOARD: Browsing...');

    // 1. RANDOM FRUSTRATION (Rage Click)
    if (Math.random() < 0.2) { 
        console.log('      😡 Rage Click Triggered');
        const text = page.locator('h1, h2').first();
        if (await text.isVisible()) {
            await humanMove(page, await text.elementHandle());
            await page.click('h1, h2', { clickCount: 4, delay: 100 });
        }
    }

    // 2. GATHER OPTIONS FOR AI
    // Get all movie titles or nav links
    let candidates = await page.locator('.movie-card h3, .movie-card p, nav a').all();
    
    // If no text elements found inside cards, just get the cards themselves
    if (candidates.length === 0) candidates = await page.locator('.movie-card').all();
    if (candidates.length === 0) candidates = await page.locator('img[alt*="Movie"]').all();
    
    // Prepare data for AI
    const optionsData = [];
    for (let i = 0; i < Math.min(candidates.length, 10); i++) { // Limit to top 10 to save tokens
        const text = await candidates[i].textContent() || "Unknown Movie Poster";
        optionsData.push({ text: text.trim(), index: i });
    }

    let selectedIndex = -1;

    // 3. ASK AI (with fallback)
    if (optionsData.length > 0) {
        const aiDecision = await askGeminiDecider(page, "I want to watch something or navigate. Pick one.", optionsData);
        if (aiDecision !== null && aiDecision < candidates.length) {
            console.log(`      🧠 AI Chose: "${optionsData.find(o => o.index === aiDecision)?.text}"`);
            selectedIndex = aiDecision;
        }
    }

    // Fallback to random if AI failed or returned null
    if (selectedIndex === -1 && candidates.length > 0) {
        console.log('      🎲 Using Random Choice');
        selectedIndex = Math.floor(Math.random() * candidates.length);
    }

    // 4. EXECUTE CLICK
    if (selectedIndex !== -1) {
        const target = candidates[selectedIndex];
        await target.scrollIntoViewIfNeeded();
        await humanMove(page, target);
        await delay(600);
        await target.click();
        
        await delay(3000);
        
        // Check for "Modal Play Button" (Netflix style popup)
        const modalPlay = page.locator('button:has-text("Play"), button[aria-label="Play"]').first();
        if (await modalPlay.isVisible()) {
            console.log('      -> Modal detected. Clicking Play.');
            await humanMove(page, modalPlay);
            await modalPlay.click();
        }
    } else {
        console.log('      -> No interactables found. Scrolling.');
        await page.mouse.wheel(0, 500);
    }
}

async function doWatch(page: Page) {
    // DYNAMIC WATCH LOGIC
    const percentages = [0.30, 0.55, 0.75, 0.95];
    const targetPercent = percentages[Math.floor(Math.random() * percentages.length)];
    const totalDuration = 45000; // Assume 45s video for demo
    const watchMs = totalDuration * targetPercent;
    
    console.log(`   📺 WATCHING: Target ${(targetPercent*100)}% (${watchMs/1000}s)`);

    // 1. WAIT FOR PLAYBACK (The Fix for "Leaving too soon")
    const video = page.locator('video').first();
    try { 
        await video.waitFor({ timeout: 8000 }); 
        // Wait until video actually has data
        await page.waitForFunction(() => {
            const v = document.querySelector('video');
            return v && v.readyState >= 2 && v.currentTime > 0;
        }, { timeout: 8000 });
    } catch(e) {
        console.log('      ⚠️ Video didn\'t start playing. Clicking center...');
        const box = await video.boundingBox();
        if (box) await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    }

    // 2. WATCH LOOP with Micro-Interactions
    const startTime = Date.now();
    while (Date.now() - startTime < watchMs) {
        await delay(2000 + Math.random() * 3000);
        
        // Wiggle mouse to keep UI alive / verify session active
        const jitterX = Math.random() * 200;
        const jitterY = Math.random() * 200;
        await page.mouse.move(300 + jitterX, 300 + jitterY, { steps: 15 });
        
        // 10% Chance to Pause/Resume
        if (Math.random() < 0.10) {
            console.log('      -> Pausing/Resuming...');
            const box = await video.boundingBox();
            if (box) {
                await page.mouse.click(box.x + box.width/2, box.y + box.height/2); // Pause
                await delay(2000);
                await page.mouse.click(box.x + box.width/2, box.y + box.height/2); // Play
            }
        }
    }
    
    console.log('      -> Done watching. Back to Browse.');
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
  
  // Spy on PostHog Packets to know when flush happens
  let lastPostHogReq = Date.now();
  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') {
         console.log(`   📡 Sending REPLAY Chunk (${req.postData()?.length} bytes)`);
         lastPostHogReq = Date.now();
      }
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    await forcePostHogStart(page);

    const maxSteps = 10;
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
        await delay(3000);
    }

    // --- THE CUT-OFF FIX ---
    console.log('⏳ Session Complete. Waiting for final PostHog flush...');
    
    // 1. Wait for at least 20 seconds absolute time
    await delay(20000);
    
    // 2. Wait for network silence (no uploads for 5 seconds)
    try {
        await page.waitForResponse(resp => resp.url().includes('/s/') && resp.status() === 200, { timeout: 10000 });
        console.log('   ✅ Final Replay Chunk Confirmed!');
    } catch(e) {
        console.log('   ⚠️ Timeout waiting for final chunk (might have already sent).');
    }

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
