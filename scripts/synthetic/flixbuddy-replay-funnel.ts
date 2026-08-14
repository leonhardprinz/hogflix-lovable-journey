/**
 * FlixBuddy replay funnel — browser-driven personas that have BOTH funnel events
 * and a watchable session recording.
 *
 * WHY THIS EXISTS
 * ---------------
 * `flixbuddy-experiment-funnel.js` builds the funnel server-side with posthog-node.
 * That is fine for experiment maths, but those personas can never have a replay:
 * session recording is rrweb DOM capture that only exists in a real browser. So
 * "View recording" on a funnel drop-off opens nothing.
 *
 * This script drives the real UI in a real browser instead. Each persona:
 *   - signs up through /signup, so the app calls posthog.identify(user.id)
 *     -> a unique Person (required: main.tsx uses person_profiles:'identified_only')
 *   - runs in its own browser context, so it gets its own $session_id + recording
 *   - reaches /flixbuddy and either sends a message or abandons
 *
 * Every event is the app's own real capture call, so the funnel steps and the
 * recording belong to the same person by construction.
 *
 * Personas are tagged via posthog.register() so every event they emit carries
 * `replay_demo: true` — filter the funnel on that and 100% of the people in it
 * have a recording to open.
 *
 * Usage:
 *   npx tsx scripts/synthetic/flixbuddy-replay-funnel.ts
 *   PERSONA_COUNT=4 HEADLESS=false npx tsx scripts/synthetic/flixbuddy-replay-funnel.ts
 */

import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page, ElementHandle } from '@playwright/test';

chromium.use(stealthPlugin());

const CONFIG = {
  baseUrl: (process.env.APP_URL || 'https://hogflix-project.vercel.app').replace(/\/$/, ''),
  personaCount: parseInt(process.env.PERSONA_COUNT || '12', 10),
  // Share of personas who open FlixBuddy and leave without sending a message.
  // These are the drop-offs at step 2 of the funnel — the ones worth watching.
  abandonRate: parseFloat(process.env.ABANDON_RATE || '0.45'),
  headless: process.env.HEADLESS !== 'false',
  password: process.env.PERSONA_PASSWORD || 'HogflixDemo!2026x',
  // Marker written onto every event these personas emit.
  batchId: process.env.REPLAY_BATCH_ID || `replay-funnel-${Date.now()}`,
};

const QUESTIONS = [
  'What should I watch tonight?',
  'Something funny and short please',
  'I want a space documentary',
  'Recommend a thriller like Se7en',
  'Any good family movies?',
  'Show me hidden gems',
];

const PROFILE_NAMES = ['Sam', 'Alex', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Quinn', 'Avery'];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** Moves the cursor in many small steps — rrweb records the path, so replays look human. */
async function humanMove(page: Page, el: ElementHandle) {
  try {
    const box = await el.boundingBox();
    if (!box) return;
    const x = box.x + box.width * 0.5 + (Math.random() * 8 - 4);
    const y = box.y + box.height * 0.5 + (Math.random() * 8 - 4);
    await page.mouse.move(x, y, { steps: 30 + Math.floor(Math.random() * 30) });
  } catch { /* element detached mid-move — the click attempt will report it */ }
}

async function clickHuman(page: Page, selector: string, timeout = 8000): Promise<boolean> {
  try {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: 'visible', timeout });
    const el = await loc.elementHandle();
    if (!el) return false;
    await humanMove(page, el);
    await delay(250 + Math.random() * 400);
    await loc.click({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** posthog-js loads async; nothing may touch window.posthog before this resolves. */
async function waitForPostHog(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => typeof (window as any).posthog?.capture === 'function',
      { timeout: 15000 },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Recording is enabled in main.tsx, but a cold context can start opted-out, and
 * calling start twice is a no-op — so we assert it rather than assume it.
 */
async function ensureRecording(page: Page) {
  await page.evaluate(() => {
    const ph = (window as any).posthog;
    if (!ph) return;
    if (ph.has_opted_out_capturing?.()) ph.opt_in_capturing();
    ph.startSessionRecording?.();
  });
}

/**
 * Super properties: persisted to localStorage and attached to every later event,
 * including the app's own captures and autocapture. Survives identify(); would be
 * cleared by posthog.reset(), so we re-apply after the auth transition.
 */
async function tagPersona(page: Page, batchId: string, variantHint: string) {
  await page.evaluate(
    ({ batchId, variantHint }) => {
      (window as any).posthog?.register?.({
        replay_demo: true,
        replay_demo_batch: batchId,
        replay_demo_intent: variantHint,
        synthetic_source: 'flixbuddy-replay-funnel',
      });
    },
    { batchId, variantHint },
  );
}

async function readIds(page: Page) {
  return page.evaluate(() => {
    const ph = (window as any).posthog;
    return {
      distinctId: ph?.get_distinct_id?.() ?? null,
      sessionId: ph?.get_session_id?.() ?? null,
    };
  });
}

/** Recording data is batched; without this the tail of the session is lost on close. */
async function flushAll(page: Page) {
  try {
    await page.evaluate(() => {
      (window as any).posthog?.sessionRecording?.flush?.();
    });
  } catch { /* page may already be closing */ }
  await delay(4000);
}

type PersonaResult = {
  email: string;
  distinctId: string | null;
  sessionId: string | null;
  outcome: 'converted' | 'abandoned' | 'failed';
  reachedFlixBuddy: boolean;
  note?: string;
};

async function runPersona(browser: Browser, index: number, total: number): Promise<PersonaResult> {
  const stamp = `${Date.now()}${index}`;
  const email = `flixbuddy-replay-${stamp}@hogflix-demo.test`;
  const willAbandon = Math.random() < CONFIG.abandonRate;
  const intent = willAbandon ? 'abandon' : 'convert';

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  const result: PersonaResult = {
    email, distinctId: null, sessionId: null, outcome: 'failed', reachedFlixBuddy: false,
  };

  console.log(`\n[${index + 1}/${total}] ${email}  (intent: ${intent})`);

  try {
    // 1. Land, opt in, start recording before anything worth recording happens.
    await page.goto(`${CONFIG.baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!(await waitForPostHog(page))) {
      result.note = 'posthog-js never loaded';
      console.log('   ✗ posthog-js never loaded');
      return result;
    }
    await ensureRecording(page);
    await tagPersona(page, CONFIG.batchId, intent);
    await clickHuman(page, 'button:has-text("Accept")', 2500);
    await page.mouse.wheel(0, 250);
    await delay(1200);

    // 2. Sign up. The app identifies the new user id here, which is what makes
    //    this persona a distinct Person in the funnel.
    await page.goto(`${CONFIG.baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 });
    await ensureRecording(page);

    for (const [sel, val] of [['#email', email], ['#password', CONFIG.password]] as const) {
      const el = await page.locator(sel).elementHandle();
      if (el) await humanMove(page, el);
      await page.locator(sel).click();
      await page.locator(sel).type(val, { delay: 45 + Math.random() * 40 });
      await delay(300);
    }
    // type="date" ignores keystroke typing reliably — fill() is correct here.
    const birthYear = 1972 + Math.floor(Math.random() * 30);
    await page.locator('#birthDate').fill(
      `${birthYear}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
    );
    await delay(600);

    if (!(await clickHuman(page, 'button[type="submit"]'))) {
      result.note = 'signup submit not clickable';
      console.log('   ✗ could not submit signup');
      return result;
    }

    // No plan param -> 'basic' -> /profiles -> single profile auto-selects -> /browse.
    try {
      await page.waitForURL(/\/browse|\/profiles/, { timeout: 30000 });
    } catch {
      result.note = `stuck after signup at ${page.url()}`;
      console.log(`   ✗ stuck after signup at ${page.url()}`);
      return result;
    }

    if (page.url().includes('/profiles')) {
      // A brand-new account has NO profile row (nothing creates one at signup),
      // so /profiles renders "Who's Watching?" with only an add affordance.
      // Creating one makes fetchProfiles see exactly 1 -> auto-select -> /browse.
      await delay(2000);
      if (page.url().includes('/profiles')) {
        const existing = await clickHuman(page, 'div:has-text("CLICK TO START")', 3000);
        if (!existing) {
          const opened =
            (await clickHuman(page, 'button:has-text("Create Your First Profile")', 4000)) ||
            (await clickHuman(page, 'div:has-text("Add Profile")', 3000));
          if (!opened) {
            result.note = 'could not open profile creation';
            console.log('   ✗ could not open profile creation');
            return result;
          }
          const nameInput = page.locator('#profileName');
          await nameInput.waitFor({ state: 'visible', timeout: 8000 });
          await nameInput.click();
          await nameInput.type(pick(PROFILE_NAMES), { delay: 70 + Math.random() * 50 });
          await delay(500);
          if (!(await clickHuman(page, 'button:has-text("CREATE PROFILE")', 5000))) {
            result.note = 'could not submit profile creation';
            console.log('   ✗ could not submit profile creation');
            return result;
          }
          console.log('   ✓ created profile');
        }
      }
    }
    try { await page.waitForURL(/\/browse/, { timeout: 20000 }); } catch { /* header nav still works */ }
    console.log('   ✓ signed up, profile active');

    // AuthContext may have reset() during the auth transition; re-apply markers.
    await ensureRecording(page);
    await tagPersona(page, CONFIG.batchId, intent);
    await delay(1500);
    await page.mouse.wheel(0, 400);
    await delay(1500);

    // 3. Into FlixBuddy via the header link, so routing/profile context survives.
    if (!(await clickHuman(page, 'a[href="/flixbuddy"]', 8000))) {
      await page.goto(`${CONFIG.baseUrl}/flixbuddy`, { waitUntil: 'domcontentloaded' });
    }
    try {
      await page.waitForURL(/\/flixbuddy/, { timeout: 15000 });
    } catch {
      result.note = 'never reached /flixbuddy';
      console.log('   ✗ never reached /flixbuddy');
      return result;
    }

    // flixbuddy:opened fires only after the chat_conversations insert resolves.
    const chatInput = 'input[placeholder*="movie"], input[placeholder*="looking"], input[placeholder*="mood"], textarea';
    try {
      await page.locator(chatInput).first().waitFor({ state: 'visible', timeout: 20000 });
    } catch {
      result.note = 'chat UI never rendered (flixbuddy:opened may not have fired)';
      console.log('   ✗ chat UI never rendered');
      return result;
    }
    result.reachedFlixBuddy = true;
    await ensureRecording(page);

    // Read ids here: this is the session that owns the funnel events.
    const ids = await readIds(page);
    result.distinctId = ids.distinctId;
    result.sessionId = ids.sessionId;
    console.log(`   ✓ FlixBuddy open — person=${ids.distinctId?.slice(0, 12)}… session=${ids.sessionId?.slice(0, 12)}…`);

    if (willAbandon) {
      // The drop-off story: read the welcome copy, hesitate, hover the box, leave.
      // Navigating away unmounts the page, which fires flixbuddy:abandoned.
      console.log('   → abandoning (reads, hesitates, leaves)');
      await delay(3000 + Math.random() * 3000);
      const inputEl = await page.locator(chatInput).first().elementHandle();
      if (inputEl) await humanMove(page, inputEl);
      await delay(1500);
      await page.mouse.wheel(0, 200);
      await delay(1200);
      await page.mouse.wheel(0, -150);
      await delay(2000 + Math.random() * 4000);
      await clickHuman(page, 'a[href="/browse"]', 4000);
      await delay(3000);
      result.outcome = 'abandoned';
    } else {
      const question = pick(QUESTIONS);
      console.log(`   → converting: "${question}"`);
      const input = page.locator(chatInput).first();
      const inputEl = await input.elementHandle();
      if (inputEl) await humanMove(page, inputEl);
      await input.click();
      await delay(500);
      // Character-by-character so the replay shows typing rather than a paste.
      await input.type(question, { delay: 55 + Math.random() * 60 });
      await delay(900);

      const sent =
        (await clickHuman(page, 'button[type="submit"], button:has(svg.lucide-send)', 5000));
      if (!sent) await page.keyboard.press('Enter');

      // Wait out the LLM round trip so the reply is on screen in the replay.
      await delay(9000 + Math.random() * 8000);

      if (Math.random() < 0.35) {
        if (await clickHuman(page, 'button:has(svg.lucide-thumbs-up)', 3000)) {
          console.log('   → gave positive feedback');
          await delay(1500);
        }
      }
      await page.mouse.wheel(0, 300);
      await delay(2500);
      result.outcome = 'converted';
    }

    await flushAll(page);
    console.log(`   ✓ done (${result.outcome})`);
    return result;
  } catch (e) {
    result.note = (e as Error).message?.slice(0, 120);
    console.log(`   ✗ error: ${result.note}`);
    return result;
  } finally {
    await context.close().catch(() => {});
  }
}

(async () => {
  console.log('FlixBuddy replay funnel');
  console.log(`  target      : ${CONFIG.baseUrl}`);
  console.log(`  personas    : ${CONFIG.personaCount}`);
  console.log(`  abandon rate: ${(CONFIG.abandonRate * 100).toFixed(0)}%`);
  console.log(`  batch id    : ${CONFIG.batchId}`);

  const browser = await chromium.launch({ headless: CONFIG.headless });
  const results: PersonaResult[] = [];

  try {
    // Sequential: each persona needs a clean context and the app does real
    // Supabase writes — parallel runs trip rate limits and muddy the replays.
    for (let i = 0; i < CONFIG.personaCount; i++) {
      results.push(await runPersona(browser, i, CONFIG.personaCount));
      await delay(1500);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const converted = results.filter((r) => r.outcome === 'converted');
  const abandoned = results.filter((r) => r.outcome === 'abandoned');
  const failed = results.filter((r) => r.outcome === 'failed');
  const withSession = results.filter((r) => r.sessionId);

  console.log('\n─── summary ──────────────────────────────');
  console.log(`  converted (sent a message) : ${converted.length}`);
  console.log(`  abandoned (funnel drop-off): ${abandoned.length}`);
  console.log(`  failed                     : ${failed.length}`);
  console.log(`  with a session id          : ${withSession.length}/${results.length}`);
  console.log(`  batch id                   : ${CONFIG.batchId}`);

  if (failed.length) {
    console.log('\n  failures:');
    for (const f of failed) console.log(`    ${f.email} — ${f.note}`);
  }

  if (withSession.length) {
    console.log('\n  session ids (each should have a replay):');
    for (const r of withSession) {
      console.log(`    ${r.outcome.padEnd(9)} ${r.sessionId}`);
    }
  }

  console.log(
    `\n  Filter the funnel on  replay_demo = true  (or replay_demo_batch = ${CONFIG.batchId})\n` +
    '  to see only personas that have a recording.\n',
  );

  // Non-zero exit if nothing worked, so a scheduled run fails loudly.
  if (!withSession.length) process.exit(1);
})();
