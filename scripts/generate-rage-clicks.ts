import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page } from '@playwright/test';

// Setup stealth
chromium.use(stealthPlugin());

// --- CONFIGURATION ---
const CONFIG = {
    baseUrl: (process.env.TARGET_URL || 'https://hogflix-demo.lovable.app').replace(/\/$/, ''),
    rageClickCount: parseInt(process.env.RAGE_CLICK_COUNT || '5'), // Number of sessions to generate
    users: [
        { email: 'toppers.tester_3c@icloud.com', password: 'sVcj_Z4HF4@sH24*xg36' },
        { email: 'slate-polders3m@icloud.com', password: 'wbt_-bwbkUe@y9J_J.sK' },
        { email: 'cabals-foyer-5w@icloud.com', password: '3f_ApN4jt4QQr@mYKg3Y' },
        { email: 'arroyo.gunner_6z@icloud.com', password: 'eavAX!qGPmHyP*J9TwKY' },
        { email: 'summers.nor-7f@icloud.com', password: 'zug2vec5ZBE.dkq*ubk' },
        { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
        { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' }
    ]
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- RAGE CLICK FUNCTION ---

async function performRageClick(page: Page) {
    console.log('   🔥 Performing realistic rage click on Ultimate button...');

    // Navigate to pricing page
    await page.goto(`${CONFIG.baseUrl}/pricing`);
    await delay(2000);

    // Find Ultimate button with multiple selectors
    const ultimateBtn = page.locator(
        'button:has-text("Ultimate"), button:has-text("ultimate"), [data-plan="ultimate"], button:has-text("ULTIMATE")'
    ).first();

    if (await ultimateBtn.isVisible()) {
        console.log('      -> Ultimate button found, starting rage click sequence...');

        // Track rage click start in PostHog
        await page.evaluate(() => {
            if ((window as any).posthog) {
                (window as any).posthog.capture('rage_click_started', {
                    button: 'ultimate_plan',
                    page: '/pricing',
                    is_synthetic: true
                });
            }
        });

        const clickCount = 5 + Math.floor(Math.random() * 7); // 5-12 clicks
        const box = await ultimateBtn.boundingBox();

        if (box) {
            for (let i = 0; i < clickCount; i++) {
                // Add jitter to make it look human
                const jitterX = (Math.random() - 0.5) * 20;
                const jitterY = (Math.random() - 0.5) * 20;
                const clickX = box.x + box.width / 2 + jitterX;
                const clickY = box.y + box.height / 2 + jitterY;

                await page.mouse.click(clickX, clickY);

                // Track each click
                await page.evaluate((clickNum: number) => {
                    if ((window as any).posthog) {
                        (window as any).posthog.capture('rage_click_attempt', {
                            button: 'ultimate_plan',
                            click_number: clickNum,
                            is_synthetic: true
                        });
                    }
                }, i + 1);

                // Variable delay - speeds up as frustration builds
                const baseDelay = 200 - (i * 15); // Start at 200ms, decrease to 50ms
                const delayMs = Math.max(50, baseDelay + Math.random() * 50);
                await delay(delayMs);

                // Pause after 3 clicks (user thinking "why isn't this working?")
                if (i === 2) {
                    await delay(500 + Math.random() * 500);
                }
            }

            // Track abandonment
            await page.evaluate((total: number) => {
                if ((window as any).posthog) {
                    (window as any).posthog.capture('rage_click_abandoned', {
                        button: 'ultimate_plan',
                        total_clicks: total,
                        is_synthetic: true
                    });
                }
            }, clickCount);

            console.log(`      ✅ Rage clicked ${clickCount} times with realistic pattern`);
        }
    } else {
        console.log('      ⚠️ Ultimate button not found on pricing page');
    }

    await delay(2000);
}

// --- MAIN EXECUTION ---

(async () => {
    console.log(`🔥 Starting Rage Click Generator - Creating ${CONFIG.rageClickCount} sessions\n`);

    for (let sessionNum = 1; sessionNum <= CONFIG.rageClickCount; sessionNum++) {
        console.log(`\n--- Session ${sessionNum}/${CONFIG.rageClickCount} ---`);

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            deviceScaleFactor: 2,
            locale: 'en-US'
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        });

        const page = await context.newPage();

        try {
            // Visit homepage
            console.log(`🔗 Visiting ${CONFIG.baseUrl}`);
            await page.goto(CONFIG.baseUrl);
            await delay(2000);

            // Accept cookies if present
            const cookie = page.locator('button:has-text("Accept")').first();
            if (await cookie.isVisible()) await cookie.click();

            // Force PostHog to start recording
            await page.evaluate(() => {
                if ((window as any).posthog) {
                    (window as any).posthog.opt_in_capturing();
                    (window as any).posthog.startSessionRecording();
                }
            });

            // Login with random user
            const user = CONFIG.users[sessionNum % CONFIG.users.length];
            console.log(`🔐 Logging in as: ${user.email}`);
            await page.goto(`${CONFIG.baseUrl}/login`);
            await page.fill('input[type="email"]', user.email);
            await page.fill('input[type="password"]', user.password);
            await page.click('button[type="submit"]');

            try {
                await page.waitForURL(/.*browse|.*profiles/, { timeout: 10000 });
            } catch (e) {
                console.log('   Note: Login redirect timeout, continuing...');
            }

            // Handle profile selection if needed
            if (page.url().includes('profiles') || await page.locator('text=Who\'s Watching?').count() > 0) {
                console.log('   -> Selecting profile...');
                const startBtn = page.locator('text="CLICK TO START"').first();
                const avatar = page.locator('.avatar').first();

                if (await startBtn.isVisible()) await startBtn.click({ force: true });
                else if (await avatar.isVisible()) await avatar.click({ force: true });

                await delay(2000);
            }

            // Browse a bit before going to pricing (more realistic)
            console.log('   -> Browsing content briefly...');
            await page.goto(`${CONFIG.baseUrl}/browse`);
            await delay(3000);

            // Scroll to simulate browsing
            await page.mouse.wheel(0, 300);
            await delay(1000);

            // Perform the rage click
            await performRageClick(page);

            // Stay on page a bit longer (user might be confused/frustrated)
            await delay(3000);

            // Flush PostHog data
            console.log('   -> Flushing PostHog session recording...');
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    if ((window as any).posthog && (window as any).posthog.sessionRecording) {
                        (window as any).posthog.sessionRecording.flush();
                        setTimeout(resolve, 5000);
                    } else {
                        resolve(undefined);
                    }
                });
            });

            console.log(`✅ Session ${sessionNum} completed successfully`);

        } catch (error) {
            console.error(`❌ Session ${sessionNum} failed:`, (error as Error).message);
        } finally {
            await browser.close();
            // Delay between sessions to avoid rate limiting
            if (sessionNum < CONFIG.rageClickCount) {
                console.log('   Waiting before next session...');
                await delay(5000);
            }
        }
    }

    console.log(`\n✅ All ${CONFIG.rageClickCount} rage click sessions completed!`);
    console.log('📊 Check PostHog Session Replays filtered by:');
    console.log('   - event = "rage_click_started" OR');
    console.log('   - properties.$current_url contains "/pricing"');
})();
