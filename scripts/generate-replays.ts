import { chromium } from '@playwright/test';

async function run() {
  // 1. Setup Browser
  const browser = await chromium.launch();
  // "New Context" = New "Incognito" window (fresh cookies/storage)
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'HogFlix-Synthetic-Bot/1.0',
  });
  const page = await context.newPage();

  // 2. Generate Fake User
  const distinctId = `user_${Math.floor(Math.random() * 100000)}`;
  
  // 3. Visit your site (Replace with your actual Lovable URL)
  // If you leave it generic, it might fail if process.env is missing.
  // SAFEST OPTION: Hardcode your URL here for the demo.
  const url = process.env.TARGET_URL || 'https://your-project-id.lovable.app'; 
  
  console.log(`🎬 Starting session for ${distinctId} on ${url}`);
  
  await page.goto(url);

  // 4. Identify User to PostHog
  await page.evaluate((id) => {
    // @ts-ignore
    if (window.posthog) window.posthog.identify(id);
  }, distinctId);

  // 5. Do "Human" things
  // Move mouse
  await page.mouse.move(100, 100);
  await page.mouse.move(200, 200, { steps: 10 }); 
  
  // Scroll down
  await page.mouse.wheel(0, 1000);
  // Wait to simulate reading
  await new Promise(r => setTimeout(r, 3000));

  // 6. CRITICAL: Wait for PostHog to upload data
  console.log('⏳ Waiting for buffer flush...');
  await new Promise(r => setTimeout(r, 10000));

  await browser.close();
  console.log('✅ Done');
}

run();
