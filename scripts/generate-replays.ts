import { chromium, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function handleAuthWall(page: Page) {
  console.log('🔒 Auth/Landing detected. Attempting entry...');
  
  let emailInput = page.locator('input[type="email"], input[name="email"]');
  
  // 1. If no inputs, click CTA
  if (await emailInput.count() === 0) {
    console.log('   -> No inputs found. Clicking CTA button...');
    const ctaBtn = page.locator('button:has-text("Sign up")')
                       .or(page.locator('button:has-text("Get Started")'))
                       .or(page.locator('button:has-text("Free")'))
                       .or(page.locator('a:has-text("Sign up")'));

    if (await ctaBtn.count() > 0) {
        await ctaBtn.first().click();
        await delay(2000); // Wait for form animation
    } else {
        console.log('   ❌ Could not find a "Sign Up" button!');
        return;
    }
  }

  // 2. Fill Form
  if (await emailInput.count() > 0) {
    const email = faker.internet.email();
    console.log(`   ✍️ Filling email: ${email}`);
    await emailInput.fill(email);
    await delay(500);

    const passInput = page.locator('input[type="password"]');
    if (await passInput.count() > 0) {
      await passInput.fill('password123');
    }
    
    // 3. ROBUST SUBMIT: Try clicking button first, then Enter
    const submitBtn = page.locator('button[type="submit"]')
                          .or(page.locator('button:has-text("Sign up")'))
                          .or(page.locator('button:has-text("Get Started")'));

    if (await submitBtn.count() > 0 && await submitBtn.first().isVisible()) {
        console.log('   🖱️ Clicking Submit Button...');
        await submitBtn.first().click();
    } else {
        console.log('   ⌨️ Pressing Enter...');
        await page.keyboard.press('Enter');
    }

    console.log(`   ✅ Form submitted. Waiting for redirect...`);
    
    // CRITICAL: Wait longer and log URL
    await delay(8000);
    console.log(`   📍 Current URL after login: ${page.url()}`);
  }
}

async function watchContent(page: Page) {
  console.log('🍿 Browsing content...');
  
  // Debug: Dump what the bot sees
  const movieCount = await page.locator('.movie-card, img[alt*="Movie"]').count();
  console.log(`   👀 Found ${movieCount} potential movie elements.`);

  const cards = page.locator('.movie-card, img[alt*="Movie"], [role="img"]');
  
  if (await cards.count() > 0) {
    const index = Math.floor(Math.random() * await cards.count());
    await cards.nth(index).hover();
    await delay(500);
    await cards.nth(index).click();
    console.log('   ▶️ Movie clicked. Watching...');
    
    // Simulate watching
    await delay(5000); 
  } else {
    console.log('   ❌ No movies found. We might still be on the landing page.');
  }
}

// --- MAIN ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    // Important: Some sites block Headless Chrome unless User-Agent is set
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // --- 🕵️ SPY TOOLS ---
  
  // 1. Log Browser Console (To see if PostHog throws errors)
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('posthog') || msg.type() === 'error') {
        console.log(`   [Browser Console] ${msg.type()}: ${text}`);
    }
  });

  // 2. Log Network Requests to PostHog (To confirm data is flying)
  page.on('request', request => {
    if (request.url().includes('posthog.com') || request.url().includes('/s/')) {
        console.log(`   📡 PostHog Request: ${request.url().substring(0, 50)}...`);
    }
  });

  try {
    const fullUrl = BASE_URL + START_PATH;
    console.log(`🔗 Visiting ${fullUrl}`);
    await page.goto(fullUrl);
    
    // Wait for JS to load
    await delay(3000);

    // Diagnostics
    const isDashboard = await page.locator('.movie-grid, text=Trending').count() > 0;
    console.log(`   🔍 Status: Dashboard=[${isDashboard}]`);

    if (isDashboard) {
      await watchContent(page);
    } else {
      await handleAuthWall(page);
      // Check again after login attempt
      if (await page.locator('.movie-grid, text=Trending').count() > 0) {
          await watchContent(page);
      }
    }

    console.log('⏳ Flushing PostHog events (Waiting 15s)...');
    await delay(15000); // Increased to 15s for slower CI networks

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
