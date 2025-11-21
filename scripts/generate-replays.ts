import { chromium, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIG ---
// You can change this to '/browse' if you want to TRY starting deep inside
const BASE_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app'; 
const START_PATH = '/'; 

const GEN_AI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- ROBUST AI BRAIN ---
async function askAI(page: Page, goal: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  // 1. Scrape visible interactive elements
  const elements = await page.evaluate(() => {
    // Get buttons, inputs, links, and images that look clickable
    const els = Array.from(document.querySelectorAll('button, a, input, img[role="button"], .movie-card'));
    return els
      .filter(el => el.getBoundingClientRect().width > 0) // Only visible
      .slice(0, 30) // Limit to top 30 elements to save tokens
      .map((el, i) => {
        const text = el.textContent?.substring(0, 50).replace(/\n/g, ' ').trim() || '';
        const placeholder = el.getAttribute('placeholder') || '';
        const tempId = `ai-target-${i}`;
        el.setAttribute('data-ai-id', tempId);
        return `ID: ${tempId} | Tag: <${el.tagName.toLowerCase()}> | Text: "${text}" | Placeholder: "${placeholder}"`;
      });
  });

  if (elements.length === 0) return null;

  // 2. Try Models (Fallback Strategy)
  // We try 'gemini-1.5-flash' first, then fall back to standard selectors if it crashes
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
    console.log('   ⚠️ AI unavailable (Quota/Model Error). Using Dumb Mode.');
  }
  return null;
}

// --- ROUTING & LOGIC ---

async function handleAuthWall(page: Page) {
  console.log('🔒 Auth Wall detected. Creating new account...');
  
  // 1. Find Email Input (Dumb mode is faster here)
  let emailInput = page.locator('input[type="email"], input[name="email"]');
  
  // If no input visible, we might be on landing page needing to click "Get Started"
  if (await emailInput.count() === 0) {
    const startBtn = await askAI(page, "Click the button to start registration or sign up");
    if (startBtn) {
      await page.click(startBtn);
    } else {
      // Dumb fallback
      await page.locator('text=Sign up, text=Get Started').first().click();
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

    // Submit
    const submitSelector = await askAI(page, "Click the Submit or Sign Up button");
    if (submitSelector) {
      await page.click(submitSelector);
    } else {
      await page.keyboard.press('Enter');
    }
    
    console.log(`   ✅ Registered as ${email}`);
    await page.waitForLoadState('networkidle'); // Wait for redirect
    await delay(3000);
  }
}

async function watchContent(page: Page) {
  console.log('🍿 Browsing content...');
  
  // Scroll a bit
  await page.mouse.wheel(0, 500);
  await delay(1000);

  // Ask AI to find a movie
  const movieSelector = await askAI(page, "Click on a movie poster or play button");
  
  if (movieSelector) {
    await page.hover(movieSelector);
    await delay(500);
    await page.click(movieSelector);
    
    console.log('   ▶️ Movie clicked. Watching...');
    // Wiggle mouse to simulate activity during watch
    for(let i=0; i<4; i++) {
      await page.mouse.move(Math.random()*500, Math.random()*500);
      await delay(3000);
    }
  } else {
    // Fallback if AI is rate limited
    console.log('   Using fallback selector for movies...');
    const cards = page.locator('.movie-card, img[alt], [role="img"]');
    if (await cards.count() > 0) {
       await cards.nth(0).click();
       await delay(5000);
    } else {
       console.log('   ❌ No movies found. Are we still on the login page?');
    }
  }
}

// --- MAIN CONTROLLER ---

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    const fullUrl = BASE_URL + START_PATH;
    console.log(`🔗 Visiting ${fullUrl}`);
    await page.goto(fullUrl);
    await delay(2000);

    // --- THE SMART ROUTER ---
    // Check where we actually landed.
    
    // 1. Are we on an Auth Page? (Look for specific text or inputs)
    const isAuthPage = await page.locator('input[type="password"], text=Sign in, text=Sign up').count() > 0;
    const isDashboard = await page.locator('text=Trending, text=New Releases, .movie-grid').count() > 0;

    if (isAuthPage && !isDashboard) {
      // We are forced to login/signup
      await handleAuthWall(page);
    }

    // 2. Now we should be logged in, let's Watch
    await watchContent(page);

    console.log('⏳ Flushing PostHog events...');
    await delay(10000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
