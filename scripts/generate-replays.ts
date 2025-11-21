import { chromium, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIG ---
const RAW_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app';
const BASE_URL = RAW_URL.replace(/\/$/, ''); 
const START_PATH = '/'; 

const GEN_AI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- AI BRAIN (With Strict Fallback) ---
async function askAI(page: Page, goal: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  
  // Quick check: Is AI quota likely exhausted? (Optional optimization)
  // For now, we just let it try and fail fast.

  const elements = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a, input, img[role="button"], .movie-card'));
    return els
      .filter(el => el.getBoundingClientRect().width > 0)
      .slice(0, 20) // Reduced to 20 to save tokens if it ever works
      .map((el, i) => {
        const text = el.textContent?.substring(0, 50).replace(/\n/g, ' ').trim() || '';
        const tempId = `ai-target-${i}`;
        el.setAttribute('data-ai-id', tempId);
        return `ID: ${tempId} | Tag: <${el.tagName.toLowerCase()}> | Text: "${text}"`;
      });
  });

  if (elements.length === 0) return null;

  try {
    const model = GEN_AI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    const prompt = `Goal: "${goal}". Elements:\n${elements.join('\n')}\nReturn ONLY the ID (e.g. ai-target-5).`;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    if (response.includes('ai-target')) return `[data-ai-id="${response.replace(/\s/g, '')}"]`;
  } catch (e) {
    // Silent failure is fine here, we rely on manual selectors
  }
  return null;
}

// --- SCENARIOS ---

async function handleAuthWall(page: Page) {
  console.log('🔒 Auth/Landing detected. Attempting entry...');
  
  // 1. Try to find an Email Input first
  let emailInput = page.locator('input[type="email"], input[name="email"]');
  
  // 2. If NO inputs, we are likely on the Landing Page. Click "Get Started" / "Sign Up"
  if (await emailInput.count() === 0) {
    console.log('   -> No inputs found. Clicking CTA button...');
    
    // BROADNED SELECTORS for your specific "Sign up free" button
    const ctaBtn = page.locator('button:has-text("Sign up")')
                       .or(page.locator('button:has-text("Get Started")'))
                       .or(page.locator('a:has-text("Sign up")'))
                       .or(page.locator('a:has-text("Get Started")'))
                       .or(page.locator('button:has-text("Free")')); // Catch "Sign up free"

    if (await ctaBtn.count() > 0) {
        await ctaBtn.first().click();
        // Wait for the click to actually open the form/page
        await delay(1000);
    } else {
        // AI Last Resort (Unlikely to work today, but good for future)
        const aiBtn = await askAI(page, "Click the button to start registration");
        if (aiBtn) await page.click(aiBtn);
    }
  }

  // 3. Now check for input AGAIN (after clicking CTA)
  if (await emailInput.count() > 0) {
    const email = faker.internet.email();
    await emailInput.fill(email);
    await delay(500);

    const passInput = page.locator('input[type="password"]');
    if (await passInput.count() > 0) {
      await passInput.fill('password123');
    }
    
    await page.keyboard.press('Enter');
    console.log(`   ✅ Registered/Logged in as ${email}`);
    await page.waitForLoadState('networkidle');
    await delay(3000);
  } else {
    console.log('   ⚠️ Could not find login form even after clicking CTA.');
  }
}

async function watchContent(page: Page) {
  console.log('🍿 Browsing content...');
  await page.mouse.wheel(0, 500);
  await delay(1000);

  // MANUAL SELECTORS (Since AI is dead)
  const cards = page.locator('.movie-card, img[alt*="Movie"], [role="img"], button[aria-label*="Play"]');
  
  if (await cards.count() > 0) {
    const index = Math.floor(Math.random() * await cards.count()); // Pick Random
    await cards.nth(index).hover();
    await delay(500);
    await cards.nth(index).click();
    
    console.log('   ▶️ Movie clicked. Watching...');
    for(let i=0; i<4; i++) {
      await page.mouse.move(Math.random()*500, Math.random()*500);
      await delay(3000);
    }
  } else {
    // Try AI as last resort
    const movieSelector = await askAI(page, "Click on a movie poster or play button");
    if (movieSelector) {
       await page.click(movieSelector);
    } else {
       console.log('   ❌ No movies found. (Maybe auth failed?)');
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

    // --- ROUTING LOGIC (SURVIVAL MODE) ---
    
    // Check for Dashboard: Only place we are "Safe"
    const movieGrid = page.locator('.movie-grid');
    const trendingText = page.locator('text=Trending');
    const isDashboard = await movieGrid.or(trendingText).count() > 0;

    // Log diagnostics
    console.log(`   🔍 Status: Dashboard=[${isDashboard}]`);

    if (isDashboard) {
      // If we are on dashboard, just watch
      await watchContent(page);
    } else {
      // IF NOT DASHBOARD -> ASSUME WE NEED AUTH
      // This covers both "Login Page" AND "Landing Page"
      await handleAuthWall(page);
      
      // Try to watch content after auth attempt
      await watchContent(page);
    }

    console.log('⏳ Flushing PostHog events...');
    await delay(10000);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
