import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

// 👥 EXPANDED USER POOL
const USERS = [
    { email: 'summers.nor-7f@icloud.com', password: 'zug2vec5ZBE.dkq*ubk' },
    { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
    { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' },
    { email: 'toppers.tester_3c@icloud.com', password: 'sVcj_Z4HF4@sH24*xg36' },
    { email: 'slate-polders3m@icloud.com', password: 'wbt_-bwbkUe@y9J_J.sK' },
    { email: 'cabals-foyer-5w@icloud.com', password: '3f_ApN4jt4QQr@mYKg3Y' },
    { email: 'arroyo.gunner_6z@icloud.com', password: 'eavAX!qGPmHyP*J9TwKY' }
];

const CURRENT_USER = USERS[Math.floor(Math.random() * USERS.length)];

// --- UTILS ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function humanMove(page, selectorOrEl) {
    let element;
    if (typeof selectorOrEl === 'string') {
        element = page.locator(selectorOrEl).first();
        if (await element.count() === 0) return;
    } else {
        element = selectorOrEl;
    }
    const box = await element.boundingBox();
    if (!box) return;

    const targetX = box.x + (box.width / 2) + (Math.random() * 20 - 10);
    const targetY = box.y + (box.height / 2) + (Math.random() * 20 - 10);
    await page.mouse.move(targetX, targetY, { steps: 35 });
}

async function forcePostHogStart(page) {
    await page.evaluate(() => {
        if (window.posthog) {
            window.posthog.register({ $device_type: 'Desktop', $browser: 'Chrome', synthetic: true });
            window.posthog.opt_in_capturing();
            window.posthog.startSessionRecording();
        }
    });
}

// --- JOURNEY LOGIC ---

async function journeyPricingTest(page) {
    console.log('   🏷️ Journey: PRICING EXPERIMENTS');
    await page.goto(`${BASE_URL}/pricing`);
    await delay(3000);

    // 1. Analyze CTA Variant (Hover plans)
    const plans = page.locator('.pricing-card');
    const count = await plans.count();
    for(let i=0; i<count; i++) {
        await humanMove(page, plans.nth(i));
        await delay(1000);
    }

    // 2. Test "Ultimate" Button (Rage Click Test)
    const ultimateBtn = page.locator('button:has-text("Ultimate"), button:has-text("Start Ultimate")').first();
    if (await ultimateBtn.isVisible()) {
        console.log('      -> Testing Ultimate Button...');
        await humanMove(page, ultimateBtn);
        
        // 50% chance to trigger "Broken" behavior if experiment is active
        // We simulate a rage click regardless to test the detector
        console.log('      😡 Rage Clicking Ultimate...');
        await page.click('button:has-text("Ultimate"), button:has-text("Start Ultimate")', { clickCount: 5, delay: 100 });
        
        // Wait to see if error toast appears
        await delay(4000);
    }
}

async function journeyBrowseTest(page) {
    console.log('   🧭 Journey: BROWSE PRIORITY EXPERIMENT');
    await page.goto(`${BASE_URL}/browse`);
    await delay(4000);

    // Detect which section is prioritized
    const popularVisible = await page.locator('text=Popular on HogFlix').isVisible();
    const trendingVisible = await page.locator('text=Trending Now').isVisible();

    if (popularVisible && !trendingVisible) {
        console.log('      -> Variant: POPULAR FIRST');
        const card = page.locator('text=Popular on HogFlix >> .. >> .movie-card').first();
        if (await card.isVisible()) {
            await humanMove(page, card);
            await card.click();
        }
    } else if (trendingVisible && !popularVisible) {
        console.log('      -> Variant: TRENDING FIRST');
        const card = page.locator('text=Trending Now >> .. >> .movie-card').first();
        if (await card.isVisible()) {
            await humanMove(page, card);
            await card.click();
        }
    } else {
        console.log('      -> Control/Mixed Variant. Clicking first available.');
        const card = page.locator('.movie-card').first();
        if (await card.isVisible()) await card.click();
    }
    
    // Wait for navigation to /watch or modal
    await delay(5000);
}

async function journeyWatch(page) {
    console.log('   📺 Journey: DEEP WATCH');
    // 1. Find a movie from Dashboard
    if (!page.url().includes('watch')) {
        const candidates = page.locator('.movie-card');
        if (await candidates.count() > 0) {
            const target = candidates.nth(Math.floor(Math.random() * await candidates.count()));
            await humanMove(page, target);
            await target.click();
            await delay(3000);
        }
    }

    // 2. Handle Modal if present
    const playBtn = page.locator('button:has-text("Play")').first();
    if (await playBtn.isVisible()) {
        await humanMove(page, playBtn);
        await playBtn.click();
    }

    // 3. Wait for Video
    try {
        await page.waitForURL(/.*watch.*/, { timeout: 8000 });
    } catch(e) {}

    // 4. Watch Logic (Long Duration)
    const watchTime = 120000 + Math.random() * 100000; // 2-4 minutes
    console.log(`      -> Watching for ${(watchTime/1000).toFixed(0)}s...`);
    
    const start = Date.now();
    while (Date.now() - start < watchTime) {
        await delay(5000);
        // Keep session alive
        await page.mouse.move(Math.random()*500, Math.random()*500, { steps: 20 });
        
        // 20% chance to interact with AI Summary if available
        if (Math.random() < 0.2) {
            const aiBtn = page.locator('button:has-text("Generate Summary"), button:has-text("AI Insight")').first();
            if (await aiBtn.isVisible()) {
                console.log('      ✨ Generating AI Summary...');
                await humanMove(page, aiBtn);
                await aiBtn.click();
                await delay(5000); // Read it
            }
        }
    }
}

async function journeyWidgetTest(page) {
    console.log('   🦔 Journey: HEDGEHOG WIDGET');
    await page.goto(BASE_URL);
    await delay(3000);
    
    const widget = page.locator('.floating-hedgehog, [aria-label="Chat"]').first();
    if (await widget.isVisible()) {
        console.log('      -> Widget Visible. Clicking...');
        await humanMove(page, widget);
        await widget.click();
        await delay(5000); // Wait for chat to open
        
        // Type something if input exists
        const input = page.locator('input[placeholder*="Ask"]').first();
        if (await input.isVisible()) {
            await input.fill("What should I watch?");
            await page.keyboard.press('Enter');
            await delay(5000);
        }
    } else {
        console.log('      -> Widget Hidden (Variant B or Wrong Page).');
    }
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
  
  // Network Spy
  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') {
         // console.log(`   📡 Sending REPLAY Chunk (${req.postData()?.length} bytes)`);
      }
  });

  try {
    const SESSION_TARGET_DURATION = 300000; // 5 Minutes Target
    const sessionStart = Date.now();

    console.log(`🔗 Visiting ${BASE_URL}`);
    await page.goto(BASE_URL);
    await delay(2000);
    
    // Cookie & Auth
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();
    await forcePostHogStart(page);

    // Login
    console.log(`   🔐 Login as ${CURRENT_USER.email}`);
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', CURRENT_USER.email);
    await page.fill('input[type="password"]', CURRENT_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*browse|.*profiles/, { timeout: 10000 }).catch(()=>console.log('Login redirect timeout'));
    
    // Handle Profile
    if (page.url().includes('profiles')) {
        const profile = page.locator('.avatar, img[alt*="profile"]').first();
        if (await profile.isVisible()) await profile.click();
        await delay(3000);
    }

    // --- PICK A JOURNEY ---
    const roll = Math.random();
    if (roll < 0.25) await journeyPricingTest(page);
    else if (roll < 0.50) await journeyBrowseTest(page);
    else if (roll < 0.70) await journeyWidgetTest(page);
    else await journeyWatch(page); // Default to watching

    // --- LOITERING PHASE (To guarantee 5 min session) ---
    console.log('   🕰️ Entering Loitering Phase to extend session...');
    while (Date.now() - sessionStart < SESSION_TARGET_DURATION) {
        const remaining = SESSION_TARGET_DURATION - (Date.now() - sessionStart);
        console.log(`      ...loitering (${(remaining/1000).toFixed(0)}s left)`);
        
        // Random actions
        await page.mouse.wheel(0, Math.random() * 500);
        await delay(5000);
        await page.mouse.move(Math.random()*800, Math.random()*600, { steps: 50 });
        
        // Maybe click a nav link
        if (Math.random() < 0.1) {
            const nav = page.locator('nav a').nth(Math.floor(Math.random() * 3));
            if (await nav.isVisible()) {
                await humanMove(page, nav);
                await nav.click();
            }
        }
    }

    console.log('⏳ Session Complete. Final Flush...');
    await page.waitForTimeout(15000); // Hard wait for last chunks

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
