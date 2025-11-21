import { chromium, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIG ---
const TARGET_URL = process.env.TARGET_URL || 'https://hogflix-demo.lovable.app/';
const GEN_AI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// --- AI BRAIN ---
async function askAI(page: Page, goal: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️ No GEMINI_API_KEY found. Falling back to dumb mode.');
    return null;
  }

  console.log(`🧠 AI Thinking: "${goal}"...`);

  // 1. Scrape interactive elements (buttons, links)
  // We get text and classes to help AI decide
  const elements = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
    return els
      .filter(el => el.checkVisibility && el.checkVisibility()) // Only visible stuff
      .map((el, i) => {
        const text = el.textContent?.substring(0, 50).trim() || '';
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        // Assign a temp ID so we can target it back
        const tempId = `ai-target-${i}`;
        el.setAttribute('data-ai-id', tempId);
        return `ID: ${tempId} | Text: "${text}" | Type: ${role}`;
      });
  });

  if (elements.length === 0) return null;

  // 2. Ask Gemini
  const model = GEN_AI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
    I am a QA bot on a website. I need to: "${goal}".
    Here is a list of visible interactive elements:
    
    ${elements.join('\n')}
    
    Return ONLY the ID (e.g., ai-target-5) of the single best element to click. 
    If nothing matches, return "NONE".
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    console.log(`   -> AI chose: ${response}`);
    
    if (response.includes('ai-target')) {
      return `[data-ai-id="${response.trim()}"]`;
    }
  } catch (e) {
    console.error('   -> AI Brain Freeze:', e);
  }
  return null;
}

// --- ACTIONS ---

async function smartNavigateToAuth(page: Page) {
  // Ask AI to find the signup entry point
  const selector = await askAI(page, "Go to the Sign Up or Register page");
  
  if (selector) {
    await page.click(selector);
  } else {
    // Fallback if AI fails or Key is missing
    console.log('   -> AI failed, using fallback selector');
    const btn = page.locator('text=Sign up, text=Get Started, text=Join').first();
    if (await btn.count() > 0) await btn.click();
  }
}

async function scenarioSignup(page: Page) {
  console.log('🆕 Scenario: AI Signing Up');
  await smartNavigateToAuth(page);
  await page.waitForLoadState('networkidle');

  // Fill form (Standard inputs are usually stable, so we keep this simple)
  // But we can ask AI for the "Submit" button just in case
  const email = faker.internet.email();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('password123');
  
  // RAGE CLICK: Ask AI what looks annoying
  const annoyanceSelector = await askAI(page, "Find a non-clickable text label like a header or description");
  if (annoyanceSelector) {
    console.log('😡 Rage clicking element selected by AI');
    await page.click(annoyanceSelector, { clickCount: 5, delay: 100 });
  }

  // Submit
  const submitSelector = await askAI(page, "Submit the form / Create Account");
  if (submitSelector) {
    await page.click(submitSelector);
  } else {
    await page.keyboard.press('Enter');
  }
}

async function scenarioWatch(page: Page) {
  console.log('🍿 Scenario: AI Watching Content');
  
  // Ask AI to pick a movie
  const movieSelector = await askAI(page, "Pick a movie card or play button to watch");
  
  if (movieSelector) {
    await page.hover(movieSelector);
    await new Promise(r => setTimeout(r, 1000));
    await page.click(movieSelector);
    
    // Simulate Watch Time
    const watchTime = Math.random() > 0.5 ? 20000 : 5000; // 20s or 5s
    console.log(`   -> Watching for ${watchTime/1000}s`);
    
    // Random mouse jitter
    for(let i=0; i<5; i++) {
        await page.mouse.move(Math.random()*500, Math.random()*500);
        await new Promise(r => setTimeout(r, watchTime/5));
    }
  } else {
    console.log('   -> AI could not find a movie.');
  }
}

// --- MAIN ---
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    console.log(`🔗 Visiting ${TARGET_URL}`);
    await page.goto(TARGET_URL);
    await new Promise(r => setTimeout(r, 2000));

    if (Math.random() > 0.3) {
      await scenarioSignup(page);
    } else {
      // Just explore
      await scenarioWatch(page);
    }

    console.log('⏳ Flushing PostHog events...');
    await new Promise(r => setTimeout(r, 10000));

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await browser.close();
  }
})();
