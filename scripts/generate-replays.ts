import { chromium, Page } from '@playwright/test';

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

// 🚨 CREDENTIALS 🚨
const DEMO_USER = {
    email: 'summers.nor-7f@icloud.com', 
    password: 'zug2vec5ZBE.dkq*ubk'
};

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function handleCookieConsent(page: Page) {
    const consentBtn = page.locator('button:has-text("Accept")')
                           .or(page.locator('button:has-text("Allow")'))
                           .or(page.locator('button:has-text("Agree")'));
    
    if (await consentBtn.count() > 0 && await consentBtn.first().isVisible()) {
        console.log('   🍪 Clicking Cookie Consent...');
        await consentBtn.first().click();
        await delay(1000);
    }
}

// 🆕 NEW FUNCTION: Handles the "Who is watching?" screen
async function handleProfileScreen(page: Page) {
    if (page.url().includes('/profiles')) {
        console.log('   👥 Profile Screen detected. Selecting a profile...');
        
        // Look for common profile elements: Images, Avatars, or just any button
        const profile = page.locator('.avatar')
                            .or(page.locator('img[alt*="profile"]'))
                            .or(page.locator('img[alt*="Profile"]'))
                            .or(page.locator('button')); // Fallback

        if (await profile.count() > 0) {
            // Click the first available profile
            await profile.first().click();
            console.log('   🖱️ Clicked Profile.');
            
            // Wait for navigation to the REAL dashboard
            await page.waitForURL(url => !url.toString().includes('/profiles'), { timeout: 10000 });
            console.log(`   ✅ Entered Dashboard: ${page.url()}`);
            await delay(2000);
        } else {
            console.log('   ❌ On profile screen but no profiles found!');
        }
    }
}

async function performLogin(page: Page) {
  console.log(`🔐 Login Start. URL: ${page.url()}`);
  
  let passInput = page.locator('input[type="password"]');
  
  // If not on auth page, click Sign In
  if (await passInput.count() === 0) {
      console.log('   -> Not on auth page. Clicking "Sign in"...');
      const signInBtn = page.locator('button:has-text("Sign in")')
                            .or(page.locator('a:has-text("Sign in")'))
                            .or(page.locator('button:has-text("Log in")'))
                            .or(page.locator('a:has-text("Log in")'));

      if (await signInBtn.count() > 0) {
          await signInBtn.first().click();
          await delay(2000); 
      }
  }

  // Fill Credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  passInput = page.locator('input[type="password"]');

  if (await emailInput.count() > 0 && await passInput.count() > 0) {
    console.log(`   ✍️ Filling credentials...`);
    await emailInput.fill(DEMO_USER.email);
    await delay(300);
    await passInput.fill(DEMO_USER.password);
    await delay(500);

    // Submit
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.count() > 0) {
        await submitBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    
    console.log('   🚀 Waiting for redirect...');
    // Wait specifically for EITHER dashboard OR profiles
    try {
        await page.waitForURL(url => !url.toString().includes('auth') && !url.toString().includes('login'), { timeout: 15000 });
        console.log(`   📍 Landed at: ${page.url()}`);
    } catch(e) {
        console.log('   ⚠️ Redirect timeout.');
    }
  }
}

async function browseContent(page: Page) {
  console.log('👀 Browsing content...');
  
  // 🆕 Extra check: Did we land on profiles?
  await handleProfileScreen(page);

  // Now look for movies
  const movies = page.locator('.movie-card')
                     .or(page.locator('img[alt*="Movie"]'))
                     .or(page.locator('[role="img"]'))
                     .or(page.locator('a[href*="/watch"]')); // Catch links to movies
  
  const count = await movies.count();
  if (count > 0) {
      console.log(`   🎬 Found ${count} movies. Watching one...`);
      const index = Math.floor(Math.random() * count);
      
      // Hover first to trigger UI effects
      await movies.nth(index).hover();
      await delay(800);
      await movies.nth(index).click();
      
      console.log('   🍿 Watching movie...');
      
      // 🆕 Force PostHog Capture manually to ensure data is sent
      await page.evaluate(() => {
          // @ts-ignore
          if (window.posthog) window.posthog.capture('synthetic_video_start');
      });

      // Simulate a long watch session (20s)
      for(let i=0; i<4; i++) {
        await page.mouse.move(Math.random()*500, Math.random()*500);
        await delay(5000);
      }
  } else {
      console.log('   ❌ No movies found.');
      // Dump page content to debug what we are actually looking at
      const title = await page.title();
      console.log(`   📄 Page Title: ${title}`);
  }
}

// --- MAIN ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    // Use standard User Agent
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Network Spy
  page.on('request', req => {
      if (req.url().includes('posthog.com') && req.url().includes('/s/')) {
          console.log('   🎥 Sending REPLAY Data');
      }
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(3000);
    
    await handleCookieConsent(page);

    // Initial check
    if (page.url().includes('/profiles')) {
        await handleProfileScreen(page);
    } else if (await page.locator('.movie-grid').count() > 0) {
        console.log('   ✅ Already on Dashboard.');
    } else {
        await performLogin(page);
    }

    // Browse
    await browseContent(page);

    console.log('⏳ Flushing Replay Buffer (Waiting 20s)...');
    await delay(20000); // 20s flush for safety

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
