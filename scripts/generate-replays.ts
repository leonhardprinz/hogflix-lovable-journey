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
    // Aggressively find and click cookie buttons
    const consentBtn = page.locator('button:has-text("Accept")')
                           .or(page.locator('button:has-text("Allow")'))
                           .or(page.locator('button:has-text("Agree")'))
                           .or(page.locator('button:has-text("Okay")'));
    
    if (await consentBtn.count() > 0 && await consentBtn.first().isVisible()) {
        console.log('   🍪 Cookie Banner detected. Smashing "Accept"...');
        await consentBtn.first().click();
        await delay(1000);
    }
}

async function performLogin(page: Page) {
  console.log(`🔐 Login Start. Current URL: ${page.url()}`);
  
  // 1. Check if we are already on an Auth page
  let passInput = page.locator('input[type="password"]');
  
  // 2. If no password field, navigate to Sign In
  if (await passInput.count() === 0) {
      console.log('   -> Not on auth page. Clicking "Sign in"...');
      const signInBtn = page.locator('button:has-text("Sign in")')
                            .or(page.locator('a:has-text("Sign in")'))
                            .or(page.locator('button:has-text("Log in")'))
                            .or(page.locator('a:has-text("Log in")'));

      if (await signInBtn.count() > 0) {
          await signInBtn.first().click();
          await delay(2000); 
      } else {
          console.log('   ℹ️ Could not find "Sign In".');
      }
  }

  // 3. Fill Credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  passInput = page.locator('input[type="password"]'); // Refresh

  if (await emailInput.count() > 0 && await passInput.count() > 0) {
    console.log(`   ✍️ Filling credentials...`);
    
    await emailInput.fill(DEMO_USER.email);
    await delay(300);
    await passInput.fill(DEMO_USER.password);
    await delay(500);

    // 4. Submit
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.count() > 0) {
        console.log('   🖱️ Clicking Submit Button...');
        await submitBtn.click();
    } else {
        console.log('   ⌨️ Pressing Enter...');
        await page.keyboard.press('Enter');
    }
    
    // WAIT FOR URL CHANGE (Max 10s)
    console.log('   🚀 Waiting for redirect...');
    try {
        await page.waitForURL(url => !url.toString().includes('auth') && !url.toString().includes('login'), { timeout: 10000 });
        console.log('   ✅ Redirect detected!');
    } catch(e) {
        console.log('   ⚠️ Redirect timeout. We might still be on the login page.');
    }
    
    console.log(`   📍 Post-Login URL: ${page.url()}`);
    console.log(`   📑 Post-Login Title: ${await page.title()}`);
  }
}

async function browseContent(page: Page) {
  console.log('👀 Browsing content...');
  
  const movies = page.locator('.movie-card')
                     .or(page.locator('img[alt*="Movie"]'))
                     .or(page.locator('[role="img"]'));
  
  const count = await movies.count();
  if (count > 0) {
      console.log(`   🎬 Found ${count} movies. Watching one...`);
      const index = Math.floor(Math.random() * count);
      await movies.nth(index).hover();
      await delay(800);
      await movies.nth(index).click();
      
      console.log('   🍿 Watching movie...');
      // Force a manual event to verify PostHog is listening
      await page.evaluate(() => {
          if ((window as any).posthog) (window as any).posthog.capture('synthetic_watch_event');
      });
      
      for(let i=0; i<3; i++) {
        await page.mouse.move(Math.random()*500, Math.random()*500);
        await delay(3000);
      }
  } else {
      console.log('   ❌ No movies found.');
      // Fallback interaction to ensure some recording exists
      await page.mouse.wheel(0, 500);
      await delay(2000);
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

  // NETWORK SPY: Only log requests to PostHog
  page.on('request', req => {
      if (req.url().includes('posthog.com')) {
          if (req.url().includes('/s/')) console.log('   🎥 Sending REPLAY Data');
          else if (req.url().includes('/e/')) console.log('   📡 Sending EVENT Data');
      }
  });

  try {
    console.log(`🔗 Visiting ${BASE_URL + START_PATH}`);
    await page.goto(BASE_URL + START_PATH);
    await delay(2000);
    
    // 1. Handle Cookie Banner (CRITICAL)
    await handleCookieConsent(page);

    // 2. Check State
    const isDashboard = await page.locator('.movie-grid').or(page.locator('text=Trending')).count() > 0;
    
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
