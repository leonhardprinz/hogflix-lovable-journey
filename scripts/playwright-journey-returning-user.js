// Returning User Journey - Existing users engaging with content
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

// Demo video ID to use
const DEMO_VIDEO_ID = '6f4d68aa-3d28-43eb-a16d-31848741832b'

function loadPersonas() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    console.log('No personas file found. Run synthetic-traffic.js first.')
    return []
  }
  return JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
}

function selectReturningPersonas(personas, count) {
  // Only select personas that have been initialized (have user_id)
  const initialized = personas.filter(p => p.user_id && p.email)
  
  // Prioritize ACTIVE and CASUAL users, some DORMANT for reactivation
  const active = initialized.filter(p => p.state === 'ACTIVE')
  const casual = initialized.filter(p => p.state === 'CASUAL')
  const dormant = initialized.filter(p => p.state === 'DORMANT')
  
  const selected = []
  
  // 60% active, 30% casual, 10% dormant
  const activeCount = Math.floor(count * 0.6)
  const casualCount = Math.floor(count * 0.3)
  const dormantCount = count - activeCount - casualCount
  
  // Randomly sample from each group
  while (selected.length < activeCount && active.length > 0) {
    const idx = Math.floor(Math.random() * active.length)
    selected.push(active.splice(idx, 1)[0])
  }
  
  while (selected.length < activeCount + casualCount && casual.length > 0) {
    const idx = Math.floor(Math.random() * casual.length)
    selected.push(casual.splice(idx, 1)[0])
  }
  
  while (selected.length < count && dormant.length > 0) {
    const idx = Math.floor(Math.random() * dormant.length)
    selected.push(dormant.splice(idx, 1)[0])
  }
  
  return selected
}

async function simulateReturningUserJourney(personas, count = 25) {
  const selected = selectReturningPersonas(personas, Math.min(count, personas.length))
  
  if (selected.length === 0) {
    console.log('No returning users available to simulate.')
    return []
  }
  
  console.log(`Simulating ${selected.length} returning user sessions...\n`)
  
  const browser = await chromium.launch({ headless: true })
  const results = []

  for (let i = 0; i < selected.length; i++) {
    const p = selected[i]
    console.log(`[RETURNING ${i + 1}/${selected.length}] ${p.email} (${p.state}, ${p.activity_pattern})`)

    const context = await browser.newContext({
      viewport: { 
        width: p.screen_width || 1920, 
        height: p.screen_height || 1080 
      }
    })
    
    const page = await context.newPage()

    try {
      // Set localStorage with PostHog distinct_id for continuity
      await page.addInitScript(({ id }) => {
        try {
          localStorage.setItem('posthog_distinct_id', JSON.stringify({ distinct_id: id }))
        } catch {}
      }, { id: p.distinct_id })

      // Navigate to browse page with UTM (returning traffic)
      const entryUrl = `${APP_URL}/browse?utm_source=${encodeURIComponent(p.source || 'direct')}&utm_medium=synthetic&utm_campaign=hogflix-returning`
      await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1000)

      // Identify user with person properties
      await page.evaluate(({ p }) => {
        window.posthog?.identify(p.distinct_id, {
          email: p.email,
          plan: p.plan,
          state: p.state,
          activity_pattern: p.activity_pattern,
          device_type: p.device_type || 'Desktop',
          browser: p.browser || 'Chrome',
          is_synthetic: true,
          returning_user: true
        })
      }, { p })

      // Determine journey based on state and activity pattern
      const sessionDepth = p.state === 'ACTIVE' ? 3 + Math.floor(Math.random() * 3)
        : p.state === 'CASUAL' ? 2 + Math.floor(Math.random() * 2)
        : 1 // dormant users just one interaction

      console.log(`  → Session depth: ${sessionDepth} interactions`)

      // Journey options
      const journeyType = Math.random()

      if (journeyType < 0.70) {
        // 70% - Watch videos (main engagement)
        console.log(`  → Journey: Video watching`)
        
        // Capture section click
        await page.evaluate(({ p }) => {
          window.posthog?.capture('section_clicked', {
            section: 'Popular',
            plan: p.plan,
            state: p.state,
            is_synthetic: true
          })
        }, { p })

        // Open video detail
        await page.evaluate(({ p, videoId }) => {
          window.posthog?.capture('title_opened', {
            title_id: videoId,
            plan: p.plan,
            is_synthetic: true
          })
        }, { p, videoId: DEMO_VIDEO_ID })

        await page.waitForTimeout(500)

        // Start video
        await page.evaluate(({ p, videoId }) => {
          window.posthog?.capture('video_started', {
            video_id: videoId,
            plan: p.plan,
            is_synthetic: true
          })
        }, { p, videoId: DEMO_VIDEO_ID })

        // Watch progress (based on engagement)
        const watchProgress = p.engagement_score > 7 ? 75 + Math.random() * 25
          : p.engagement_score > 5 ? 50 + Math.random() * 30
          : 25 + Math.random() * 30

        if (watchProgress >= 50) {
          await page.evaluate(({ p, videoId, progress }) => {
            window.posthog?.capture('video_progress', {
              video_id: videoId,
              milestone: 50,
              progress_percentage: Math.floor(progress),
              plan: p.plan,
              is_synthetic: true
            })
          }, { p, videoId: DEMO_VIDEO_ID, progress: watchProgress })
        }

        // Rate video (30% chance for engaged users)
        if (p.engagement_score > 6 && Math.random() < 0.3) {
          const rating = p.plan === 'premium' ? 4 + Math.floor(Math.random() * 2)
            : p.plan === 'standard' ? 3 + Math.floor(Math.random() * 3)
            : 2 + Math.floor(Math.random() * 4)

          await page.evaluate(({ p, videoId, rating }) => {
            window.posthog?.capture('video_rated', {
              video_id: videoId,
              rating: rating,
              plan: p.plan,
              is_synthetic: true
            })
          }, { p, videoId: DEMO_VIDEO_ID, rating })
        }

      } else if (journeyType < 0.85) {
        // 15% - Pricing page visit (upgrade intent)
        console.log(`  → Journey: Pricing exploration`)
        
        await page.goto(`${APP_URL}/pricing`, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(2000 + Math.random() * 3000)

        await page.evaluate(({ p }) => {
          window.posthog?.capture('pricing_page_viewed', {
            current_plan: p.plan,
            state: p.state,
            upgrade_intent: true,
            is_synthetic: true
          })
        }, { p })

        // Some click on plan cards (50%)
        if (Math.random() < 0.5) {
          try {
            const buttons = await page.$$('button:has-text("Choose"), button:has-text("Upgrade")')
            if (buttons.length > 0) {
              await buttons[0].click()
              await page.waitForTimeout(1000)
              
              await page.evaluate(({ p }) => {
                window.posthog?.capture('upgrade_button_clicked', {
                  current_plan: p.plan,
                  is_synthetic: true
                })
              }, { p })
            }
          } catch (e) {
            // Button not found
          }
        }

      } else {
        // 10% - FlixBuddy engagement (if implemented)
        console.log(`  → Journey: FlixBuddy chat`)
        
        try {
          await page.goto(`${APP_URL}/flixbuddy`, { waitUntil: 'domcontentloaded', timeout: 15000 })
          await page.waitForTimeout(1500)

          await page.evaluate(({ p }) => {
            window.posthog?.capture('flixbuddy_opened', {
              plan: p.plan,
              state: p.state,
              is_synthetic: true
            })
          }, { p })

          // Simulate typing and sending a message
          await page.waitForTimeout(2000 + Math.random() * 3000)
          
          await page.evaluate(({ p }) => {
            window.posthog?.capture('flixbuddy_message_sent', {
              plan: p.plan,
              is_synthetic: true
            })
          }, { p })

        } catch (e) {
          console.log(`  ! FlixBuddy page not accessible`)
        }
      }

      console.log(`  ✓ Session completed`)
      results.push({ email: p.email, success: true })

    } catch (error) {
      console.error(`  ! Error:`, error.message)
      results.push({ email: p.email, success: false, error: error.message })
    } finally {
      await context.close()
    }

    // Small delay between sessions
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700))
  }

  await browser.close()
  
  const successful = results.filter(r => r.success).length
  console.log(`\n[SUMMARY] ${successful}/${selected.length} returning user sessions completed`)
  
  return results
}

// Main execution
;(async () => {
  const count = parseInt(process.env.RETURNING_USER_COUNT || '25', 10)
  console.log(`Loading personas and selecting ${count} returning users...\n`)
  
  try {
    const personas = loadPersonas()
    if (personas.length === 0) {
      console.log('No personas available. Run synthetic-traffic.js first to create personas.')
      process.exit(0)
    }
    
    await simulateReturningUserJourney(personas, count)
    console.log(`\nAll sessions completed. Check PostHog for engagement data.`)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
})()
