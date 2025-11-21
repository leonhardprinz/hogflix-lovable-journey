import { chromium, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
// Safe base URL (removes trailing slash if present)
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

const GEN_AI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- AI BRAIN ---
async function askAI(page: Page, goal: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  // 1. Scrape visible interactive elements
  const elements = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a, input, img[role="button"], .movie-card'));
    return els
      .filter(el => el.getBoundingClientRect().width > 0)
      .slice(0, 30)
      .map((el, i) => {
        // Clean up text to avoid newlines breaking JSON/Prompts
        const text = el.textContent?.substring(0, 50).replace(/\n/g, ' ').trim() || '';
        const placeholder = el.getAttribute('placeholder') || '';
        const tempId = `ai-target-${i}`;
        el.setAttribute('data-ai-id', tempId);
        return `ID: ${tempId} | Tag: <${el.tagName.toLowerCase()}> | Text: "${text}" | Placeholder: "${placeholder}"`;
      });
  });

  if (elements.length === 0) return null;

  // 2. Try Models
  try {
    const model = GEN_AI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    
    const prompt = `
      Goal: "${goal}".
      Elements:
      ${elements.join('\n')}
      
      Return ONLY the ID (e.g. ai-target-5) of the best element. If nothing fits, return NONE.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    
    if (response.includes('ai-target')) {
      console.log(`   🧠 AI chose: ${response}`);
      return `[data-ai-id="${response.replace(/\s/g, '')}"]`;
    }
  } catch (e) {
    console.log('   ⚠️ AI unavailable. Using Dumb Mode.');
  }
  return null;
}

// --- SCENARIOS ---

async function handleAuthWall(page: Page) {
  console.log('🔒 Auth Wall detected. Creating new account...');
  
  // 1. Find Email Input
  let emailInput = page.locator('input[type="email"], input[name="email"]');
  
  // If no input, we need to click "Get Started"
  if (await emailInput.count() === 0) {
    // Safe locator using .or() to mix strategies
    const startBtns = page.locator('button:has-text("Sign up")')
                          .or(page.locator('button:has-text("Get Started")'))
                          .or(page.locator('a:has-text("Sign up")'));
                          
    if (await startBtns.count() > 0) {
        await startBtns.first().click();
    } else {
        // AI Fallback
        const aiBtn = await askAI(page, "Click the button to start registration");
        if (aiBtn) await page.click(aiBtn);
    }
    await delay(1000);
  }

  // 2. Fill Registration
  if (await emailInput.count() > 0) {
    const email = faker.internet.email();
    await emailInput.fill(email);
    await delay(500);

    const passInput = page.locator('input[type="password"]');
    if (await passInput.count() > 0) {
      await passInput.fill('password123');
    }
    
    await page.keyboard.press('Enter');
    
    console.log(`   ✅ Registered as ${email}`);
    await page.waitForLoadState('networkidle');
    await delay(3000);
  }
}

async function watchContent(page: Page) {
  console.log('🍿 Browsing content...');
  await page.mouse.wheel(0, 500);
  await delay(1000);

  // Try AI first
  const movieSelector = await askAI(page, "Click on a movie poster or play button");
  
  if (movieSelector) {
    await page.hover(movieSelector);
    await delay(500);
    await page.click(movieSelector);
    
    console.log('   ▶️ Movie clicked. Watching...');
    // Wiggle mouse
    for(let i=0; i<4; i++) {
      await page.mouse.move(Math.random()*500, Math.random()*500);
      await delay(3000);
    }
  } else {
    // Manual Fallback
    console.log('   Using fallback selector for movies...');
    // Use CSS-only selectors here to be safe
    const cards = page.locator('.movie-card, img[alt*="Movie"], [role="img"]');
    if (await cards.count() > 0) {
       await cards.nth(0).click();
       await delay(5000);
    } else {
       console.log('   ❌ No movies found.');
    }
  }
}

// --- MAIN ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    const fullUrl = BASE_URL + START_PATH;
    console.log(`🔗 Visiting ${fullUrl}`);
    await page.goto(fullUrl);
    await delay(2000);

    // --- SMART ROUTER (FIXED) ---
    
    // Check for Auth Elements (Use .or() to safely combine checks)
    const hasPassword = await page.locator('input[type="password"]').count() > 0;
    const hasEmail = await page.locator('input[type="email"]').count() > 0;
    
    // Combine locators safely
    const signInBtn = page.locator('button:has-text("Sign in")').or(page.locator('a:has-text("Sign in")'));
    const hasSignIn = await signInBtn.count() > 0;
    
    // Check for Dashboard Elements
    // We check specific classes OR specific text separately
    const movieGrid = page.locator('.movie-grid');
    const trendingText = page.locator('text=Trending');
    // This .or() prevents the syntax error you saw
    const isDashboard = await movieGrid.or(trendingText).count() > 0;

    console.log(`   🔍 Diagnostics: Auth=[${hasPassword || hasEmail || hasSignIn}] Dashboard=[${isDashboard}]`);

    if ((hasPassword || hasEmail || hasSignIn) && !isDashboard) {
      await handleAuthWall(page);
    } else {
      console.log('   -> Already on dashboard (or no auth wall found).');
    }

    await watchContent(page);

    console.log('⏳ Flushing PostHog events...');
    await delay(10000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
