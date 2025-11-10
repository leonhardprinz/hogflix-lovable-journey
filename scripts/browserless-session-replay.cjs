const puppeteer = require('puppeteer');

// Configuration
const APP_URL = process.env.APP_URL || 'https://hogflix.lovable.app';
const POSTHOG_KEY = process.env.POSTHOG_KEY;
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;

if (!BROWSERLESS_API_KEY) {
  throw new Error('BROWSERLESS_API_KEY environment variable not set.');
}

const pagesToVisit = [
  { path: '/?synthetic=1', wait: 8000, description: 'Homepage' },
  { path: '/browse?synthetic=1', wait: 6000, description: 'Browse' },
  { path: '/pricing?synthetic=1', wait: 5000, description: 'Pricing' },
  { path: '/demo/big-buck-bunny?synthetic=1', wait: 5000, description: 'Video' },
];

async function runSessionReplay() {
  console.log('🚀 Connecting to Browserless.io...');
  console.log(`🔑 Using API key: ${BROWSERLESS_API_KEY.substring(0, 8)}...`);
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io/?token=${BROWSERLESS_API_KEY}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Listen to console messages for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('PostHog') || text.includes('session')) {
      console.log('📊 Browser console:', text);
    }
  });

  console.log(`📍 Starting journey through ${pagesToVisit.length} pages...`);

  for (const pageInfo of pagesToVisit) {
    const url = `${APP_URL}${pageInfo.path}`;
    console.log(`\n→ Navigating to: ${pageInfo.description} (${url})`);

    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for PostHog to initialize
      console.log('  ⏳ Waiting for PostHog...');
      await page.waitForFunction(
        () => window.posthog && window.posthog.__loaded,
        { timeout: 10000 }
      );
      console.log('  ✓ PostHog initialized');

      // Check if session recording started
      const recordingStatus = await page.evaluate(() => {
        return {
          sessionId: window.posthog?.get_session_id(),
          recordingEnabled: window.posthog?.sessionRecording?.status === 'active',
        };
      });
      console.log('  📹 Recording status:', recordingStatus);

      // Wait for user activity simulation
      console.log(`  ⏱️  Waiting ${pageInfo.wait}ms for activity...`);
      await page.waitForTimeout(pageInfo.wait);
      console.log('  ✓ Done');

    } catch (error) {
      console.error(`  ❌ Error on ${pageInfo.description}:`, error.message);
    }
  }

  console.log('\n✅ Session replay journey complete!');
  console.log('🔄 Browserless.io will handle cleanup and data flushing...');
  
  await browser.disconnect();
  console.log('👋 Disconnected from Browserless.io');
}

runSessionReplay().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
