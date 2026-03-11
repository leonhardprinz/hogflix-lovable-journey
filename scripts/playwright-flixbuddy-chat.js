// FlixBuddy Chat Session Replay Generator
// Uses Playwright to actually navigate to FlixBuddy and have real AI conversations.
// This creates genuine session replays in PostHog with real LLM interactions visible.
//
// Usage: node scripts/playwright-flixbuddy-chat.js
// Env: APP_URL, POSTHOG_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { chromium } from 'playwright'

const APP_URL = process.env.APP_URL || 'https://hogflix-project.vercel.app'
const DEBUG = process.env.DEBUG === 'true'
const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
const SESSION_COUNT = parseInt(process.env.FLIXBUDDY_SESSION_COUNT || '3', 10)

// Users who have accounts and can log in
const USERS = [
    { email: 'summers.nor-7f@icloud.com', password: 'zug2vec5ZBE.dkq*ubk' },
    { email: 'slatted_combats.9i@icloud.com', password: 'qmt8fhv2vju1DMC*bzn' },
    { email: 'treadle-tidbit-1b@icloud.com', password: 'avf6zqh6tfn!rap.MED' },
]

// Realistic FlixBuddy chat prompts — things a real user would ask
const CHAT_PROMPTS = [
    ["What's trending right now?"],
    ["I want something funny", "Any hedgehog comedies?"],
    ["Recommend a family movie for tonight"],
    ["What's similar to Lord of the Hogs?", "That sounds great, tell me more about the first one"],
    ["I'm in the mood for a thriller", "Is it scary?"],
    ["Show me hidden gems I might have missed"],
    ["What are the best action movies on HogFlix?", "Add the first one to my watchlist"],
    ["I liked Jurassic Hog, what else?"],
    ["Suggest a binge-worthy series", "How many episodes?"],
    ["Any new releases this week?", "Which one has the best reviews?"],
    // PII-heavy conversation — useful for demoing redaction
    [
        "Hi! My name is Sarah Thompson and I'm looking for a movie to watch with my husband Michael Johnson tonight",
        "Michael's email is michael.johnson@gmail.com — can you send him the recommendation too? His phone is +1-555-867-5309",
        "Actually my friend Dr. Rebecca Martinez recommended Lord of the Hogs to us. She said her colleague James O'Brien loved it. What do you think?",
    ],
]

const log = (step, detail = '') => {
    const ts = new Date().toISOString().split('T')[1].slice(0, 8)
    console.log(`[${ts}] ${step}${detail ? ` - ${detail}` : ''}`)
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

async function runFlixBuddySession(user, sessionIndex) {
    log(`\n🎬 Session ${sessionIndex + 1}: ${user.email}`)

    const browser = await chromium.launch({
        headless: IS_CI ? true : !DEBUG,
        slowMo: DEBUG ? 500 : 0,
        args: IS_CI
            ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            : ['--window-size=1920,1080']
    })

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    // Remove automation signals
    await context.addInitScript(() => {
        delete Object.getPrototypeOf(navigator).webdriver
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
    })

    const page = await context.newPage()

    if (DEBUG) {
        page.on('console', msg => console.log(`  [BROWSER]: ${msg.text()}`))
    }

    try {
        // 1. Login
        log('🔐 Logging in...', user.email)
        await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await delay(2000)

        await page.fill('input[type="email"]', user.email)
        await delay(500)
        await page.fill('input[type="password"]', user.password)
        await delay(500)
        await page.click('button[type="submit"]')

        // Wait for redirect to browse or profiles
        await page.waitForURL(/.*browse|.*profiles/, { timeout: 15000 }).catch(() => {
            log('⚠️ Login redirect timeout, continuing anyway')
        })
        await delay(3000)

        // Handle profile selection if needed
        if (page.url().includes('profiles')) {
            log('👤 Selecting profile...')
            const profile = page.locator('.cursor-pointer').first()
            if (await profile.count() > 0) {
                await profile.click()
                await delay(3000)
            }
        }

        // 2. Check PostHog is recording
        const phStatus = await page.evaluate(() => ({
            loaded: !!window.posthog?.__loaded,
            recording: !!window.posthog?.sessionRecording,
            sessionId: window.posthog?.get_session_id?.() || 'none'
        }))
        log(`📊 PostHog: loaded=${phStatus.loaded}, recording=${phStatus.recording}, session=${phStatus.sessionId}`)

        // Force-start session recording (mirrors synthetic-traffic.js forcePostHogStart)
        await page.evaluate(() => {
            if (window.posthog) {
                window.posthog.register({ synthetic: true, synthetic_source: 'playwright-flixbuddy' });
                window.posthog.opt_in_capturing();
                window.posthog.startSessionRecording();
            }
        });
        log('📹 Forced session recording start')

        // 3. Browse for a moment (creates context in the session replay)
        log('🏠 Browsing homepage...')
        await page.goto(`${APP_URL}/browse`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await delay(3000)

        // Scroll through content naturally
        await page.mouse.move(500, 400)
        await page.evaluate(() => window.scrollBy(0, 300))
        await delay(2000)
        await page.evaluate(() => window.scrollBy(0, 300))
        await delay(1500)

        // 4. Navigate to FlixBuddy
        log('🤖 Opening FlixBuddy...')

        // Try nav link first
        const flixbuddyLink = page.locator('a[href="/flixbuddy"], a:has-text("FlixBuddy")').first()
        if (await flixbuddyLink.count() > 0) {
            await flixbuddyLink.click()
        } else {
            await page.goto(`${APP_URL}/flixbuddy`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        }
        await delay(5000) // Wait for FlixBuddy to initialize and welcome message

        // 5. Have a conversation
        const prompts = pick(CHAT_PROMPTS)
        log(`💬 Starting conversation (${prompts.length} messages)`)

        for (let i = 0; i < prompts.length; i++) {
            const msg = prompts[i]
            log(`   → Sending: "${msg}"`)

            // Find and fill the input
            const input = page.locator('input[placeholder*="Ask FlixBuddy"], input[placeholder*="recommendation"]').first()
            if (await input.count() === 0) {
                log('   ⚠️ Chat input not found, skipping')
                break
            }

            // Type naturally
            await input.click()
            await delay(300)
            await input.fill('')
            for (const char of msg) {
                await input.type(char, { delay: 50 + Math.random() * 80 })
            }
            await delay(800)

            // Send message
            const sendBtn = page.locator('button:has(svg)').last() // Send button with icon
            await sendBtn.click()

            // Wait for response (FlixBuddy needs time to call the LLM)
            log('   ⏳ Waiting for FlixBuddy response...')
            await delay(8000 + Math.random() * 7000) // 8-15 seconds for LLM response

            // Scroll to see the response
            const messagesContainer = page.locator('.overflow-y-auto').first()
            if (await messagesContainer.count() > 0) {
                await messagesContainer.evaluate(el => el.scrollTop = el.scrollHeight)
            }
            await delay(2000)

            // Maybe interact with thumbs feedback on assistant messages
            if (Math.random() < 0.4) {
                const thumbsUp = page.locator('button:has(svg.h-3.w-3)').first()
                if (await thumbsUp.count() > 0 && await thumbsUp.isVisible()) {
                    await thumbsUp.click()
                    log('   👍 Left positive feedback')
                    await delay(1000)
                }
            }
        }

        // 6. Maybe click a recommended video
        if (Math.random() < 0.5) {
            log('🎥 Checking recommendations panel...')
            const videoCard = page.locator('button:has-text("Watch")').first()
            if (await videoCard.count() > 0 && await videoCard.isVisible()) {
                await videoCard.click()
                log('   ▶️ Clicked a recommended video')
                await delay(5000) // Watch for a bit
            }
        }

        // 7. Flush ALL PostHog data (events + session recording)
        // posthog.flush() drains the regular event queue (including $ai_generation events).
        // sessionRecording.flush() sends the rrweb snapshots.
        // Without both, the browser can close before events are uploaded.
        log('📹 Flushing PostHog events + session recording...')
        const sessionIdBeforeFlush = await page.evaluate(() => window.posthog?.get_session_id?.() || 'unknown')
        log(`   Session ID: ${sessionIdBeforeFlush}`)
        await page.evaluate(() => {
            return new Promise((resolve) => {
                if (window.posthog) {
                    // Flush regular event queue first
                    window.posthog.flush()
                    // Flush session recording chunks
                    if (window.posthog.sessionRecording) {
                        window.posthog.sessionRecording.flush()
                    }
                    // Wait for uploads to complete (10s gives generous time for network)
                    setTimeout(resolve, 10000)
                } else {
                    resolve()
                }
            })
        })

        log(`✅ Session ${sessionIndex + 1} complete!`)

    } catch (error) {
        log(`❌ Session ${sessionIndex + 1} failed: ${error.message}`)
        if (DEBUG) {
            await page.screenshot({ path: `./flixbuddy_error_${Date.now()}.png` }).catch(() => { })
        }
    } finally {
        await browser.close()
    }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🤖 FlixBuddy Session Replay Generator')
    console.log('━'.repeat(50))
    console.log(`   Sessions: ${SESSION_COUNT}`)
    console.log(`   Users: ${USERS.length}`)
    console.log(`   App: ${APP_URL}`)
    console.log('━'.repeat(50))

    let successes = 0

    for (let i = 0; i < SESSION_COUNT; i++) {
        const user = USERS[i % USERS.length]
        try {
            await runFlixBuddySession(user, i)
            successes++
        } catch (err) {
            console.error(`Session ${i + 1} error:`, err.message)
        }

        // Brief pause between sessions
        if (i < SESSION_COUNT - 1) {
            await delay(3000)
        }
    }

    console.log('\n' + '━'.repeat(50))
    console.log(`✅ Done! ${successes}/${SESSION_COUNT} FlixBuddy sessions completed`)
    console.log('📹 Check PostHog Session Replay for real FlixBuddy conversations')
}

main().catch(console.error)
