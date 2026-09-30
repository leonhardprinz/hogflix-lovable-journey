/**
 * Video engagement funnel — browser-driven viewers who actually watch.
 *
 * WHY THIS EXISTS
 * ---------------
 * The player streams HLS (hls.js over MSE, H.264). Playwright's bundled Chromium
 * ships without proprietary codecs, so in the other persona scripts the video
 * never plays: `video:started` fires, `timeupdate` never does, and the
 * "started -> 25% -> 50% -> 75% -> completed" funnel shows 100% drop-off.
 *
 * This script launches real Google Chrome (`channel: 'chrome'`, which has the
 * codecs), so playback is real and every milestone is the app's own capture call
 * from VideoPlayer.tsx. Each viewer:
 *   - signs up in a real browser -> its own Person + its own session recording
 *   - opens a title from Browse (hero "Watch Now" or a card)
 *   - watches, scrubbing forward like a real viewer, and stops at a depth drawn
 *     from VIEWER_MIX (bail early / quarter / half / most / to the end)
 *
 * Every event carries `replay_demo: true` and `synthetic_source:
 * 'video-engagement-funnel'`, so drop-offs at each step open a recording.
 *
 * Usage:
 *   npx playwright install chrome   # once, if Chrome isn't installed
 *   npx tsx scripts/synthetic/video-engagement-funnel.ts
 *   VIEWER_COUNT=2 HEADLESS=false npx tsx scripts/synthetic/video-engagement-funnel.ts
 */

import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page, ElementHandle } from '@playwright/test';

chromium.use(stealthPlugin());

const CONFIG = {
  baseUrl: (process.env.APP_URL || 'https://hogflix-project.vercel.app').replace(/\/$/, ''),
  viewerCount: parseInt(process.env.VIEWER_COUNT || '10', 10),
  headless: process.env.HEADLESS !== 'false',
  password: process.env.PERSONA_PASSWORD || 'HogflixDemo!2026x',
  batchId: process.env.REPLAY_BATCH_ID || `video-funnel-${Date.now()}`,
};

// How far each kind of viewer gets, as a share of the video. Weights shape the
// funnel: roughly 100% start -> ~78% reach 25% -> ~57% reach 50% -> ~40% reach 75%
// -> ~27% finish.
const VIEWER_MIX: { type: string; weight: number; stopAt: [number, number] }[] = [
  { type: 'bailed_early', weight: 22, stopAt: [0.06, 0.2] },
  { type: 'quarter', weight: 21, stopAt: [0.3, 0.46] },
  { type: 'half', weight: 17, stopAt: [0.55, 0.7] },
  { type: 'most', weight: 13, stopAt: [0.8, 0.9] },
  { type: 'finished', weight: 27, stopAt: [0.99, 1] },
];

const PROFILE_NAMES = ['Sam', 'Alex', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Quinn', 'Avery'];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const between = (a: number, b: number) => a + Math.random() * (b - a);

function pickViewer() {
  const total = VIEWER_MIX.reduce((s, v) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const v of VIEWER_MIX) {
    if ((r -= v.weight) <= 0) return v;
  }
  return VIEWER_MIX[VIEWER_MIX.length - 1];
}

/** Moves the cursor in many small steps — rrweb records the path, so replays look human. */
async function humanMove(page: Page, el: ElementHandle) {
  try {
    const box = await el.boundingBox();
    if (!box) return;
    const x = box.x + box.width * 0.5 + (Math.random() * 8 - 4);
    const y = box.y + box.height * 0.5 + (Math.random() * 8 - 4);
    await page.mouse.move(x, y, { steps: 30 + Math.floor(Math.random() * 30) });
  } catch { /* element detached mid-move */ }
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

async function waitForPostHog(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(() => typeof (window as any).posthog?.capture === 'function', { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function ensureRecording(page: Page) {
  await page.evaluate(() => {
    const ph = (window as any).posthog;
    if (!ph) return;
    if (ph.has_opted_out_capturing?.()) ph.opt_in_capturing();
    ph.startSessionRecording?.();
  });
}

/** Super properties survive identify() but not reset(), so this is re-applied after signup. */
async function tagViewer(page: Page, viewerType: string) {
  await page.evaluate(
    ({ batchId, viewerType }) => {
      (window as any).posthog?.register?.({
        replay_demo: true,
        replay_demo_batch: batchId,
        viewer_type: viewerType,
        synthetic_source: 'video-engagement-funnel',
      });
    },
    { batchId: CONFIG.batchId, viewerType },
  );
}

async function flushAll(page: Page) {
  try {
    await page.evaluate(() => (window as any).posthog?.sessionRecording?.flush?.());
  } catch { /* page may already be closing */ }
  await delay(4000);
}

/** Signup -> profile -> /browse. Same path as flixbuddy-replay-funnel.ts. */
async function signUp(page: Page, email: string): Promise<string | null> {
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
  const birthYear = 1972 + Math.floor(Math.random() * 30);
  await page.locator('#birthDate').fill(
    `${birthYear}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
  );
  await delay(600);
  if (!(await clickHuman(page, 'button[type="submit"]'))) return 'signup submit not clickable';

  try {
    await page.waitForURL(/\/browse|\/profiles/, { timeout: 30000 });
  } catch {
    return `stuck after signup at ${page.url()}`;
  }

  if (page.url().includes('/profiles')) {
    await delay(2000);
    if (page.url().includes('/profiles')) {
      const existing = await clickHuman(page, 'div:has-text("CLICK TO START")', 3000);
      if (!existing) {
        const opened =
          (await clickHuman(page, 'button:has-text("Create Your First Profile")', 4000)) ||
          (await clickHuman(page, 'div:has-text("Add Profile")', 3000));
        if (!opened) return 'could not open profile creation';
        const nameInput = page.locator('#profileName');
        await nameInput.waitFor({ state: 'visible', timeout: 8000 });
        await nameInput.click();
        await nameInput.type(pick(PROFILE_NAMES), { delay: 70 + Math.random() * 50 });
        await delay(500);
        if (!(await clickHuman(page, 'button:has-text("CREATE PROFILE")', 5000))) return 'could not submit profile creation';
      }
    }
  }
  try { await page.waitForURL(/\/browse/, { timeout: 20000 }); } catch { /* checked by caller */ }
  return null;
}

/** Hero "Watch Now" half the time, otherwise a title card further down the page. */
async function openTitle(page: Page): Promise<boolean> {
  await page.locator('a[href*="/watch/"]').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await delay(1500);
  if (Math.random() < 0.5 && (await clickHuman(page, 'a[href*="/watch/"]:has(button:has-text("Watch Now")), button:has-text("Watch Now")', 4000))) {
    // hero
  } else {
    await page.mouse.wheel(0, 350 + Math.random() * 300);
    await delay(1500);
    const cards = await page.locator('a[href*="/watch/"]').all();
    const visible: typeof cards = [];
    for (const c of cards) {
      const box = await c.boundingBox().catch(() => null);
      if (box && box.y > 0 && box.y < 700 && box.width > 60) visible.push(c);
    }
    const card = visible.length ? pick(visible) : page.locator('a[href*="/watch/"]').first();
    const el = await card.elementHandle();
    if (el) await humanMove(page, el);
    await delay(700);
    await card.click({ timeout: 5000 }).catch(() => {});
  }
  try {
    await page.waitForURL(/\/watch\//, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

type VideoState = { t: number; d: number; paused: boolean; ended: boolean };

async function videoState(page: Page): Promise<VideoState | null> {
  return page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? { t: v.currentTime, d: v.duration, paused: v.paused, ended: v.ended } : null;
  });
}

/** Starts playback for real and returns the duration, or null if the media never plays. */
async function startPlayback(page: Page): Promise<number | null> {
  const video = page.locator('video').first();
  await video.waitFor({ state: 'attached', timeout: 20000 });
  for (let attempt = 0; attempt < 4; attempt++) {
    await delay(2500);
    const s = await videoState(page);
    if (s && !s.paused && s.t > 0.5 && Number.isFinite(s.d) && s.d > 0) return s.d;
    const box = await video.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
  const s = await videoState(page);
  return s && s.t > 0.5 && Number.isFinite(s.d) && s.d > 0 ? s.d : null;
}

/**
 * Watches to `stopAt` of the video. Real playback between scrubs, so each
 * milestone's timeupdate is organic; long videos are scrubbed forward in steps
 * (visible in the replay as a viewer skipping ahead).
 */
async function watchTo(page: Page, duration: number, stopAt: number) {
  const checkpoints = [0.26, 0.51, 0.76, 0.965].filter((c) => c <= stopAt);
  for (const c of checkpoints) {
    const s = await videoState(page);
    if (!s) return;
    const target = c * duration;
    if (target - s.t > 12) {
      // skip ahead to just before the checkpoint, then let it play through it
      await page.evaluate((to) => {
        const v = document.querySelector('video');
        if (v) v.currentTime = to;
      }, Math.max(0, target - 3));
      await delay(800);
    }
    await page.evaluate(() => document.querySelector('video')?.play()?.catch(() => {}));
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      await delay(1500);
      const now = await videoState(page);
      if (!now || now.ended || now.t >= target + 0.5) break;
      await page.mouse.move(400 + Math.random() * 300, 300 + Math.random() * 150, { steps: 12 });
    }
  }
  // Linger at the stopping point, then leave the way a person would.
  const finalTarget = stopAt * duration;
  const s = await videoState(page);
  if (s && !s.ended && finalTarget - s.t > 12 && stopAt < 0.99) {
    await page.evaluate((to) => {
      const v = document.querySelector('video');
      if (v) v.currentTime = to;
    }, finalTarget - 4);
  }
  await delay(between(3000, 6000));
  if (stopAt >= 0.99) {
    // let it run out so the ended handler fires too
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      const now = await videoState(page);
      if (!now || now.ended) break;
      await delay(1500);
    }
  }
}

type ViewerResult = {
  email: string;
  viewerType: string;
  outcome: 'watched' | 'failed';
  reached?: string;
  sessionId?: string | null;
  note?: string;
};

async function runViewer(browser: Browser, index: number, total: number): Promise<ViewerResult> {
  const email = `video-viewer-${Date.now()}${index}@hogflix-demo.test`;
  const viewer = pickViewer();
  const stopAt = between(viewer.stopAt[0], viewer.stopAt[1]);
  const result: ViewerResult = { email, viewerType: viewer.type, outcome: 'failed' };
  console.log(`\n[${index + 1}/${total}] ${email}  (${viewer.type}, stops at ${(stopAt * 100).toFixed(0)}%)`);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  try {
    await page.goto(`${CONFIG.baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!(await waitForPostHog(page))) {
      result.note = 'posthog-js never loaded';
      return result;
    }
    await ensureRecording(page);
    await tagViewer(page, viewer.type);
    await clickHuman(page, 'button:has-text("Accept")', 2500);
    await page.mouse.wheel(0, 250);
    await delay(1200);

    const signupError = await signUp(page, email);
    if (signupError) {
      result.note = signupError;
      return result;
    }
    await ensureRecording(page);
    await tagViewer(page, viewer.type);
    console.log('   ✓ signed up');

    if (!(await openTitle(page))) {
      result.note = `never reached a /watch page (at ${page.url()})`;
      return result;
    }
    await ensureRecording(page);
    const duration = await startPlayback(page);
    if (!duration) {
      result.note = 'video never played (codecs? use channel chrome)';
      return result;
    }
    result.sessionId = await page.evaluate(() => (window as any).posthog?.get_session_id?.() ?? null);
    console.log(`   ✓ playing (${duration.toFixed(0)}s) session=${result.sessionId?.slice(0, 12)}…`);

    await watchTo(page, duration, stopAt);
    const s = await videoState(page);
    result.reached = s ? `${((s.t / duration) * 100).toFixed(0)}%` : '?';
    console.log(`   ✓ stopped at ${result.reached}`);

    // Leave the player: back to Browse via the header, like closing the title.
    if (!(await clickHuman(page, 'a[href="/browse"]', 4000))) await page.goBack().catch(() => {});
    await delay(2500);
    await flushAll(page);
    result.outcome = 'watched';
    return result;
  } catch (e) {
    result.note = (e as Error).message?.slice(0, 140);
    return result;
  } finally {
    if (result.outcome === 'failed') console.log(`   ✗ ${result.note}`);
    await context.close().catch(() => {});
  }
}

(async () => {
  console.log('Video engagement funnel');
  console.log(`  target  : ${CONFIG.baseUrl}`);
  console.log(`  viewers : ${CONFIG.viewerCount}`);
  console.log(`  batch id: ${CONFIG.batchId}`);

  // Real Chrome: bundled Chromium can't decode the H.264 HLS stream.
  const browser = await chromium.launch({ headless: CONFIG.headless, channel: 'chrome' });
  const results: ViewerResult[] = [];
  try {
    for (let i = 0; i < CONFIG.viewerCount; i++) {
      results.push(await runViewer(browser, i, CONFIG.viewerCount));
      await delay(1500);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const watched = results.filter((r) => r.outcome === 'watched');
  console.log('\n─── summary ──────────────────────────────');
  for (const r of results) {
    console.log(`  ${r.outcome.padEnd(8)} ${r.viewerType.padEnd(13)} ${(r.reached || '').padEnd(5)} ${r.note || r.sessionId || ''}`);
  }
  console.log(`  watched: ${watched.length}/${results.length}`);
  if (!watched.length) process.exit(1);
})();
