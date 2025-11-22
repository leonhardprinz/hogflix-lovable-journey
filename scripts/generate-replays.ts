import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page, ElementHandle } from '@playwright/test';

chromium.use(stealthPlugin());

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

// 👥 EXPANDED CAST
const USERS = [
    { email: 'summers.nor-7f@icloud.com',  password: 'zug2vec5ZBE.dkq*ubk' },
    { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
    { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' }
];

// Pick random user for this run
const CURRENT_USER = USERS[Math.floor(Math.random() * USERS.length)];

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🐭 SLOW HAND PHYSICS
 * Moves mouse in a curve with variable speed
 */
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

    // Target: Slightly off-center (humans aren't perfect)
    const targetX = box.x + (box.width / 2) + (Math.random() * 20 - 10);
    const targetY = box.y + (box.height / 2) + (Math.random() * 20 - 10);

    // "Steps" determines slowness. Higher = Slower.
    // We use 50 steps for a very lazy, human feel.
    await page.mouse.move(targetX, targetY, { steps: 50 });
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

// --- STATE MACHINE ---

async function detectState(page: Page) {
    const url = page.url();
    if (url.includes('/auth') || url.includes('/login')) return 'AUTH';
    if (url.includes('/profiles')) return 'PROFILES';
    if (url.includes('/watch')) return 'WATCHING';
    
    if (await page.locator('input[type="password"]').count() > 0) return 'AUTH';
    if (await page.locator('text=Who’s Watching?').count() > 0) return 'PROFILES';
    
    const dashboardSignals = page.locator('.movie-card')
                                 .or(page.locator('nav'))
                                 .or(page.locator('text=Home'))
                                 .or(page.locator('text=My List'));

    if (await dashboardSignals.count() > 0) return 'DASHBOARD';
    return 'UNKNOWN';
}

async function doLogin(page: Page) {
    console.log(`   🔐 State: AUTH. User: ${CURRENT_USER.email}`);
    
    await humanMove(page, 'input[type="email"]');
    await page.fill('input[type="email"], input[name="email"]', CURRENT_USER.email);
    await delay(500);
    
    await humanMove(page, 'input[type="password"]');
    await page.fill('input[type="password"]', CURRENT_USER.password);
    
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.isVisible()) {
        await humanMove(page, await btn.elementHandle());
        await btn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    
    console.log('   🚀 Submitted.');
    await delay(5000);
}

async function doProfileSelection(page: Page) {
    console.log('   👥 State: PROFILES.');
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
    await delay(5000);
}

async function doBrowse(page: Page) {
    console.log('   🍿 State: DASHBOARD.');

    // 1. FRUSTRATION ENGINE (Rage Clicks)
    if (Math.random() < 0.15) { // 15% chance
        console.log('      😡 Frustration Event!');
        // Click a random non-interactive text
        const text = page.locator('h1, h2, p').first();
        if (await text.isVisible()) {
            await humanMove(page, await text.elementHandle());
            await page.click('h1, h2, p', { clickCount: 5, delay: 80 }); // Rage click
        } else {
            // Dead click on empty space
            await page.mouse.click(100, 300);
        }
    }

    // 2. DECISION TREE
    const roll = Math.random();
    
    // 30% Explore Nav (Pricing, FlixBuddy)
    if (roll < 0.30) {
        console.log('      -> Decision: Explore Nav');
        const links = page.locator('nav a, header a');
        const count = await links.count();
        if (count > 0) {
            const target = links.nth(Math.floor(Math.random() * count));
            const text = await target.textContent();
            if (text && !text.toLowerCase().includes('out')) { // Don't logout
                 await humanMove(page, await target.elementHandle());
                 await target.click();
                 await delay(4000);
                 return;
            }
        }
    }

    // 70% Watch Movie
    console.log('      -> Decision: Pick Movie');
    let candidates = page.locator('.movie-card');
    // Fallbacks
    if (await candidates.count() === 0) candidates = page.locator('img[alt*="Movie"]');
    
    if (await candidates.count() > 0) {
        const index = Math.floor(Math.random() * await candidates.count());
        const target = candidates.nth(index);
        
        await target.scrollIntoViewIfNeeded();
        await humanMove(page, await target.elementHandle());
        await delay(500);
        await target.click();
        
        await delay(3000);
        
        // Handle Modal Play Button
        const modalPlay = page.locator('button:has-text("Play"), button[aria-label="Play"]');
        if (await modalPlay.count() > 0 && await modalPlay.first().isVisible()) {
            console.log('      -> Modal detected. Playing.');
            await humanMove(page, await modalPlay.first().elementHandle());
            await modalPlay.first().click();
        }
    }
    await delay(2000);
}

async function doWatch(page: Page) {
    // DYNAMIC WATCH LOGIC
    const percentages = [0.30, 0.55, 0.75, 0.95];
    const targetPercent = percentages[Math.floor(Math.random() * percentages.length)];
    
    // Assume avg video is ~45 seconds for demo purposes
    const totalDuration = 45000; 
    const watchMs = totalDuration * targetPercent;
    
    console.log(`   📺 State: WATCHING. Target: ${(targetPercent*100)}% (${watchMs/1000}s)`);

    // 1. Ensure Video is Playing
    const video = page.locator('video').first();
    // Wait up to 5s for video tag to appear
    try { await video.waitFor({ timeout: 5000 }); } catch(e) {}

    // Check if playing, if not click center
    const isPaused = await page.evaluate(() => {
        const v = document.querySelector('video');
        return v ? v.paused : true;
    });
    
    if (isPaused) {
        console.log('      -> Video paused. Clicking to start...');
        const box = await video.boundingBox();
        if (box) {
            await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        }
    }

    // 2. The Watch Loop (with Keep-Alive Jitter)
    const startTime = Date.now();
    while (Date.now() - startTime < watchMs) {
        // Every 4 seconds, wiggle mouse so PostHog knows we are alive
        await delay(4000);
        
        const jitterX = Math.random() * 100;
        const jitterY = Math.random() * 100;
        // Small, idle movement
        await page.mouse.move(300 + jitterX, 300 + jitterY, { steps: 10 });
        
        // 5% chance to pause and resume (indecisive user)
        if (Math.random() < 0.05) {
             console.log('      -> User paused briefly...');
             const box = await video.boundingBox();
             if (box) await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
             await delay(2000);
             if (box) await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        }
    }
    
    console.log('      -> Watch target reached. Leaving.');
    await page.goBack();
    await delay(3000);
}

// --- MAIN ---

(async () => {
  // Launch browser using playwright-extra
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 2,
    locale: 'en-US'
  });

  const page = await context.newPage();

  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') {
         // console.log(`   🎥 Sending REPLAY (${req.postData()?.length} bytes)`);
      }
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    await forcePostHogStart(page);

    // Increased steps to ensure we hit multiple videos/pages
    const maxSteps = 12;
    for (let step = 0; step < maxSteps; step++) {
        const state = await detectState(page);
        console.log(`🔄 Step ${step+1}/${maxSteps}: [${state}]`);
        
        switch (state) {
            case 'AUTH': await doLogin(page); break;
            case 'PROFILES': await doProfileSelection(page); break;
            case 'DASHBOARD': await doBrowse(page); break;
            case 'WATCHING': await doWatch(page); break;
            case 'UNKNOWN':
                console.log('   ❓ Unknown. Scrolling...');
                const login = page.locator('button:has-text("Sign in")').first();
                if (await login.isVisible()) await login.click();
                else await page.mouse.wheel(0, 500);
                break;
        }
        
        if (step % 2 === 0) await forcePostHogStart(page);
        await delay(2000);
    }

    // Increased flush time to 30s to catch the tail end of long sessions
    console.log('⏳ Flushing Replay Buffer (Waiting 30s)...');
    await delay(30000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
