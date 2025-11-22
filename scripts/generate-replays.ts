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

async function ensurePostHogLoaded(page: Page) {
    console.log('⏳ Waiting for PostHog to initialize...');
    try {
        await page.waitForFunction(() => (window as any).posthog !== undefined, { timeout: 5000 });
        console.log('   ✅ PostHog loaded!');
    } catch (e) {
        console.log('   ⚠️ PostHog did not load in 5s. (Continuing anyway...)');
    }
}

async function performLogin(page: Page) {
  console.log('🔐 Attempting Login...');
  
  // 1. Check if we are already on an Auth page
  let passInput = page.locator('input[type="password"]');
  
  // 2. If no password field, find the "Sign In" button to get there
  if (await passInput.count() === 0) {
      console.log('   -> Not on auth page yet. Clicking "Sign in"...');
      // SAFE SELECTOR CHAINING (No comma mixing)
      const signInBtn = page.locator('button:has-text("Sign in")')
                            .or(page.locator('a:has-text("Sign in")'))
                            .or(page.locator('button:has-text("Log in")'))
                            .or(page.locator('a:has-text("Log in")'));

      if (await signInBtn.count() > 0) {
          await signInBtn.first().click();
          await delay(2000); 
      } else {
          console.log('   ℹ️ Could not find "Sign In". Assuming logged in or landing page.');
      }
  }

  // 3. Fill Credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  passInput = page.locator('input[type="password"]'); // Refresh locator

  if (await emailInput.count() > 0 && await passInput.count() > 0) {
    console.log(`   ✍️ Filling credentials for ${DEMO_USER.email}`);
    
    await emailInput.fill(DEMO_USER.email);
    await delay(300);
    await passInput.fill(DEMO_USER.password);
    await delay(500);

    // 4. Submit
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.count() > 0) {
        await submitBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    
    console.log('   🚀 Credentials submitted. Waiting for redirect...');
    await delay(5000);
  } else {
    console.log('   ⚠️ No login inputs visible. Skipping auth.');
  }
}

async function browseContent(page: Page) {
  console.log('👀 Browsing content...');
  
  // Try to find movies (Dashboard)
  // Use .or() here too just to be safe, though CSS commas are usually valid for simple classes
  const movies = page.locator('.movie-card')
                     .or(page.locator('img[alt*="Movie"]'))
                     .or(page.locator('[role="img"]'));
  
  if (await movies.count() > 0) {
      console.log(`   🎬 Found ${await movies.count()} movies. Watching one...`);
      const index = Math.floor(Math.random() * await movies.count());
      await movies.nth(index).hover();
      await delay(800);
      await movies.nth(index).click();
      
      console.log('   🍿 Watching movie...');
      for(let i=0; i<3; i++) {
        await page.mouse.move(Math.random()*500, Math.random()*500);
        await delay(3000);
      }
  } else {
      console.log('   🏖️ On Landing Page (No movies found). Scrolling around...');
      await page.mouse.wheel(0, 500);
      await delay(2000);
      await page.mouse.wheel(0, 500);
      await delay(2000);
      
      const cta = page.locator('button').or(page.locator('a[href]')).first();
      if (await cta.isVisible()) await cta.hover();
  }
}

// --- MAIN ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Network Spy
  page.on('request', req => {
      if (req.url().includes('/s/') && req.method() === 'POST') {
          console.log('   📡 Sending Replay Data to PostHog...');
      }
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    
    // 1. Wait for PostHog
    await ensurePostHogLoaded(page);

    // 2. Check State (THE FIX IS HERE)
    // We cannot mix CSS and text= in one string. We use .or()
    const isDashboard = await page.locator('.movie-grid')
                                  .or(page.locator('text=Trending'))
                                  .count() > 0;
    
    if (isDashboard) {
        console.log('   ✅ Already on Dashboard.');
    } else {
        await performLogin(page);
    }

    // 3. Browse
    await browseContent(page);

    console.log('⏳ Flushing Replay Buffer (Waiting 15s)...');
    await delay(15000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
