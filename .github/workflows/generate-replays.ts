import { chromium } from 'playwright';

// Config - Change this URL to your live app URL if needed, or set via ENV
const TARGET_URL = process.env.TARGET_URL || 'https://your-actual-app-url.lovable.app'; 

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSession() {
  console.log('🚀 Starting Synthetic Session Replay Generator...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'HogFlix-Synthetic-Traffic/1.0 (Playwright)',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // 1. Create a Random User ID
  // This ensures PostHog sees a "New User" every time
  const distinctId = `synthetic_${Math.random().toString(36).substring(7)}`;
  console.log(`👤 Generated User ID: ${distinctId}`);

  try {
    // 2. Go to the page
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    
    // 3. Inject PostHog Identify immediately
    // This links the session to the ID we just made
    await page.evaluate((id) => {
      // @ts-ignore
      if (window.posthog) {
        // @ts-ignore
        window.posthog.identify(id); 
        console.log('✅ PostHog Identified');
      }
    }, distinctId);

    // 4. Simulate Interaction (The "Dance")
    // Random mouse movements to look human
    console.log('🖱️ Simulating interactions...');
    
    // Move mouse randomly
    for (let i = 0; i < 5; i++) {
        const x = Math.floor(Math.random() * 1000);
        const y = Math.floor(Math.random() * 800);
        await page.mouse.move(x, y, { steps: 10 });
        await delay(500);
    }

    // Scroll down
    await page.mouse.wheel(0, 500);
    await delay(2000);

    // Try to click a "Movie Card" or any image
    // We use a generic selector so it works on most apps
    const clickTargets = page.locator('img, button, a').first();
    if (await clickTargets.count() > 0) {
        await clickTargets.hover();
        await delay(500);
        // await clickTargets.click(); // Uncomment if you want it to actually click
        console.log('  - Hovered over an element');
    }

    // 5. THE MOST IMPORTANT PART: Flush Wait
    // We must wait for PostHog to upload the recording data
    console.log('⏳ Waiting 10s for PostHog buffer flush...');
    await delay(10000);

  } catch (error) {
    console.error('❌ Error during session:', error);
    process.exit(1);
  } finally {
    await browser.close();
    console.log('✨ Session Complete');
  }
}

runSession();
