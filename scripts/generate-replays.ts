import { chromium, Page } from '@playwright/test';

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

const USER = {
    email: 'summers.nor-7f@icloud.com', 
    password: 'zug2vec5ZBE.dkq*ubk'
};

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function detectState(page: Page) {
    const url = page.url();
    if (url.includes('/auth') || url.includes('/login')) return 'AUTH';
    if (url.includes('/profiles')) return 'PROFILES';
    if (url.includes('/watch')) return 'WATCHING';
    
    // UI Checks
    if (await page.locator('input[type="password"]').count() > 0) return 'AUTH';
    if (await page.locator('text=Who’s Watching?').count() > 0) return 'PROFILES';
    
    // Dashboard Check (Broad)
    const dashboardSignals = page.locator('.movie-card')
                                 .or(page.locator('nav'))
                                 .or(page.locator('header'))
                                 .or(page.locator('text=Home'))
                                 .or(page.locator('text=Trending'))
                                 .or(page.locator('text=My List'));

    if (await dashboardSignals.count() > 0) return 'DASHBOARD';
    return 'UNKNOWN';
}

async function doLogin(page: Page) {
    console.log('   🔐 State: AUTH. Filling credentials...');
    await page.fill('input[type="email"], input[name="email"]', USER.email);
    await delay(200);
    await page.fill('input[type="password"]', USER.password);
    
    const btn = page.locator('button[type="submit"]').first();
    if (await btn.isVisible()) await btn.click();
    else await page.keyboard.press('Enter');
    
    console.log('   🚀 Submitted.');
    await delay(5000);
}

async function doProfileSelection(page: Page) {
    console.log('   👥 State: PROFILES. Picking a user...');
    const userText = page.locator(`text=${USER.email.split('@')[0]}`).first();
    const avatar = page.locator('.avatar, img[alt*="profile"]').first();
    
    if (await userText.isVisible()) await userText.click();
    else if (await avatar.isVisible()) await avatar.click();
    else {
        const vp = page.viewportSize();
        if (vp) await page.mouse.click(vp.width/2, vp.height/2);
    }
    await delay(5000);
}

// 🆕 UPDATED: BROAD SPECTRUM BROWSING
async function doBrowse(page: Page) {
    console.log('   🍿 State: DASHBOARD. Hunting for content...');
    
    // 1. Try standard cards first
    let candidates = page.locator('.movie-card, [role="article"]');
    
    // 2. If none, try ANY image inside a link or button (Posters)
    if (await candidates.count() === 0) {
        candidates = page.locator('a:has(img), button:has(img)');
    }

    // 3. If STILL none, try any "Play" button/icon
    if (await candidates.count() === 0) {
         candidates = page.locator('button[aria-label*="Play"]')
                          .or(page.locator('.lucide-play')) // Shadcn Play Icon
                          .or(page.locator('text=Play'));
    }

    const count = await candidates.count();
    if (count > 0) {
        // Pick one randomly
        const index = Math.floor(Math.random() * count);
        console.log(`      -> Found ${count} candidates. Clicking #${index}`);
        
        const target = candidates.nth(index);
        await target.scrollIntoViewIfNeeded();
        await target.hover();
        await delay(500);
        await target.click();
        
        // Wait to see if it opened a "Modal" (Netflix style) or navigated
        await delay(3000);
        
        // CHECK: Did we open a modal with a "Play" button inside?
        const modalPlay = page.locator('button:has-text("Play")')
                              .or(page.locator('button[aria-label="Play"]'));
                              
        if (await modalPlay.count() > 0 && await modalPlay.first().isVisible()) {
             console.log('      -> Modal detected. Clicking BIG Play button...');
             await modalPlay.first().click();
             await delay(2000);
        }
    } else {
        console.log('      -> No clickable movies found. Scrolling...');
        await page.mouse.wheel(0, 500);
        await delay(2000);
    }
}

async function doWatch(page: Page) {
    console.log('   📺 State: WATCHING.');
    const watchTime = 8000 + Math.random() * 5000;
    
    // Move mouse to keep controls visible/active
    await page.mouse.move(200, 200);
    await delay(watchTime);
    
    console.log('      -> Done. Going back.');
    await page.goBack();
    await delay(3000);
}

// --- MAIN LOOP ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Network Spy
  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') console.log('   🎥 Sending Replay Data');
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    const cookies = page.locator('button:has-text("Accept"), button:has-text("Allow")');
    if (await cookies.count() > 0) await cookies.first().click();

    const maxSteps = 8;
    
    for (let step = 0; step < maxSteps; step++) {
        const state = await detectState(page);
        console.log(`🔄 Step ${step+1}/${maxSteps}: Detected [${state}]`);
        
        switch (state) {
            case 'AUTH': await doLogin(page); break;
            case 'PROFILES': await doProfileSelection(page); break;
            case 'DASHBOARD': await doBrowse(page); break;
            case 'WATCHING': await doWatch(page); break;
            case 'UNKNOWN':
                console.log('   ❓ Unknown state. Scrolling...');
                // If on landing, try to sign in. If deep inside, try to go home.
                const loginBtn = page.locator('button:has-text("Sign in")').first();
                if (await loginBtn.isVisible()) await loginBtn.click();
                else await page.mouse.wheel(0, 500);
                break;
        }
        await delay(3000);
    }

    console.log('⏳ Flushing Replay Buffer (Waiting 15s)...');
    await delay(15000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
