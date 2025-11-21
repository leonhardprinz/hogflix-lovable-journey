import { chromium, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

// CONFIGURATION
const TARGET_URL = 'https://hogflix-demo.lovable.app/';
// Create ONE real user in your app manually and put credentials here
// This allows us to simulate "Returning User" retention metrics
const DEMO_USER = {
  email: 'demo_viewer@hogflix.com', 
  password: 'password123' 
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// UTILS
async function simulateRageClick(page: Page) {
  console.log('😡 Simulating Rage Click...');
  // Find something that isn't a button (like a label or header) and click it furiously
  const annoyance = page.locator('h1, label, .text-muted').first();
  if (await annoyance.count() > 0) {
    await annoyance.click({ clickCount: 8, delay: 50 }); // 8 clicks in 400ms
  }
}

async function humanScroll(page: Page) {
  await page.mouse.wheel(0, Math.random() * 500 + 200);
  await delay(Math.random() * 1000 + 500);
}

// SCENARIOS
async function scenarioNewUserSignup(page: Page) {
  console.log('🆕 Scenario: New User Sign Up');
  
  // 1. Navigate to Signup (assuming redirect or button click)
  // If your app redirects to login automatically:
  if (page.url().includes('auth') || page.url().includes('login')) {
    const signupLink = page.locator('text=Sign up').first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
    }
  }

  // 2. Fill Form
  await delay(1000);
  const email = faker.internet.email();
  const password = 'password123';
  
  // Fill inputs (adjust selectors to match your Shadcn/Supabase forms)
  await page.locator('input[type="email"]').fill(email);
  await delay(500);
  
  // 3. RAGE MOMENT: User tries to click submit before password
  await simulateRageClick(page);
  
  await page.locator('input[type="password"]').fill(password);
  await delay(800);

  // 4. Submit
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  
  console.log(`   -> Signed up as ${email}`);
  
  // Wait for redirect to home
  await page.waitForURL('**/', { timeout: 10000 }).catch(() => console.log('   -> Navigation timeout (might be okay)'));
}

async function scenarioReturningUserLogin(page: Page) {
  console.log('🔙 Scenario: Returning User Login');
  
  // If already on home, logout first? Or assume clean session means we are at auth wall.
  if (page.url().includes('auth')) {
    await page.locator('input[type="email"]').fill(DEMO_USER.email);
    await delay(300);
    await page.locator('input[type="password"]').fill(DEMO_USER.password);
    await delay(500);
    await page.locator('button[type="submit"]').click();
    console.log(`   -> Logged in as ${DEMO_USER.email}`);
    
    // Wait for home
    await page.waitForURL('**/', { timeout: 10000 }).catch(() => {});
  }
}

async function scenarioWatchContent(page: Page) {
  console.log('🍿 Scenario: Browsing & Watching');
  
  // 1. Browse Home
  await humanScroll(page);
  await humanScroll(page);
  
  // 2. Pick a Movie (Randomly)
  // Looks for Play buttons or Movie Cards
  const playButtons = page.locator('button:has-text("Play"), .movie-card');
  const count = await playButtons.count();
  
  if (count > 0) {
    const index = Math.floor(Math.random() * count);
    console.log(`   -> Clicking movie #${index}`);
    
    // Hover first (human behavior)
    await playButtons.nth(index).hover();
    await delay(800);
    await playButtons.nth(index).click();
    
    // 3. Watch Logic (Drop-off simulator)
    // Weighted random: 
    // 20% = Immediate Bounce (5s)
    // 50% = Casual Watch (30s)
    // 30% = Engaged Watch (2m)
    const dice = Math.random();
    let watchTime = 5000;
    
    if (dice > 0.2) watchTime = 30000;
    if (dice > 0.7) watchTime = 120000; // 2 minutes
    
    console.log(`   -> Watching for ${(watchTime/1000).toFixed(0)}s...`);
    
    // While watching, move mouse occasionally so session stays "active"
    const steps = Math.floor(watchTime / 5000);
    for (let i = 0; i < steps; i++) {
      await page.mouse.move(Math.random() * 500, Math.random() * 500);
      await delay(5000);
    }
  } else {
    console.log('   -> No movies found to click!');
  }
}

// MAIN EXECUTION
async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log(`🔗 Navigating to ${TARGET_URL}`);
    await page.goto(TARGET_URL);
    await delay(2000);

    // DECIDE USER TYPE
    const isReturning = Math.random() < 0.3; // 30% chance of returning user

    if (isReturning) {
      await scenarioReturningUserLogin(page);
    } else {
      await scenarioNewUserSignup(page);
    }

    // EVERYONE WATCHES CONTENT
    await scenarioWatchContent(page);

    // BUFFER FLUSH
    console.log('⏳ Waiting for PostHog events to flush...');
    await delay(10000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
    console.log('✨ Session Finished');
  }
}

run();
