// ============= PHASE 4: AI-POWERED BEHAVIOR ADAPTATION =============
// Automatically discovers new features and generates realistic interactions

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const AI_BEHAVIORS_FILE = path.join(STATE_DIR, 'ai_behaviors.json')
const SUPABASE_URL = 'https://ygbftctnpvxhflpamjrt.supabase.co'
const DEBUG = process.env.DEBUG === 'true'

// Pages to analyze
const PAGES_TO_ANALYZE = [
  { name: 'Home', url: '/', selector: 'main' },
  { name: 'Browse', url: '/browse', selector: 'main' },
  { name: 'VideoPlayer', url: '/demo/6f4d68aa-3d28-43eb-a16d-31848741832b', selector: 'main' },
  { name: 'Pricing', url: '/pricing', selector: 'main' },
  { name: 'FlixBuddy', url: '/flixbuddy', selector: 'main' },
]

// Analysis refresh interval (7 days)
const ANALYSIS_REFRESH_DAYS = 7

// ============ BEHAVIOR STORAGE ============

function loadAIBehaviors() {
  if (fs.existsSync(AI_BEHAVIORS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(AI_BEHAVIORS_FILE, 'utf8'))
    } catch (error) {
      console.error('❌ Error loading AI behaviors:', error.message)
      return {}
    }
  }
  return {}
}

function saveAIBehaviors(behaviors) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true })
  }
  fs.writeFileSync(AI_BEHAVIORS_FILE, JSON.stringify(behaviors, null, 2))
}

function shouldRefreshAnalysis(lastAnalyzedAt) {
  if (!lastAnalyzedAt) return true

  const lastDate = new Date(lastAnalyzedAt)
  const now = new Date()
  const daysSince = (now - lastDate) / (1000 * 60 * 60 * 24)

  return daysSince >= ANALYSIS_REFRESH_DAYS
}

// ============ DOM CAPTURE ============

async function capturePageDOM(page, url, selector) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(2000) // Let page settle

    const html = await page.evaluate((sel) => {
      const element = document.querySelector(sel)
      return element ? element.outerHTML : document.body.outerHTML
    }, selector)

    return html
  } catch (error) {
    console.error(`  ❌ Error capturing ${url}:`, error.message)
    return null
  }
}

// ============ AI ANALYSIS ============

async function analyzePageWithAI(pageName, pageUrl, pageHtml, existingBehaviors = []) {
  try {
    console.log(`  🤖 Analyzing ${pageName} with Gemini AI...`)

    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-page-structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pageUrl,
        pageHtml,
        pageName,
        existingBehaviors,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Analysis failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Analysis failed')
    }

    console.log(`  ✅ Analysis complete: ${result.analysis?.newElementsFound?.length || 0} new elements found`)
    return result.analysis

  } catch (error) {
    console.error(`  ❌ AI analysis error for ${pageName}:`, error.message)
    return null
  }
}

// ============ BEHAVIOR GENERATION ============

async function generateBehaviors(analysis, pageName, pageUrl, personaType = 'general') {
  try {
    console.log(`  🎬 Generating behaviors for ${pageName} (${personaType} persona)...`)

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-synthetic-behaviors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysis,
        pageName,
        pageUrl,
        personaType,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Generation failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Generation failed')
    }

    console.log(`  ✅ Generated ${result.behaviors?.length || 0} behaviors`)
    return result.behaviors

  } catch (error) {
    console.error(`  ❌ Behavior generation error for ${pageName}:`, error.message)
    return []
  }
}

// ============ MAIN EXECUTION ============

export async function runPhase4Analysis() {
  console.log('🚀 Phase 4: AI-Powered Behavior Analysis')
  console.log('   Analyzing pages for new interactive elements...\n')

  const allBehaviors = loadAIBehaviors()
  let analysisRun = false

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  for (const pageConfig of PAGES_TO_ANALYZE) {
    const pageKey = pageConfig.name.toLowerCase()
    const existingData = allBehaviors[pageKey] || {}

    console.log(`\n📄 ${pageConfig.name} (${pageConfig.url})`)

    // Check if analysis needed
    if (!shouldRefreshAnalysis(existingData.lastAnalyzedAt)) {
      const daysSince = Math.floor((Date.now() - new Date(existingData.lastAnalyzedAt)) / (1000 * 60 * 60 * 24))
      console.log(`  ⏭️  Skipping - analyzed ${daysSince} days ago (refresh every ${ANALYSIS_REFRESH_DAYS} days)`)
      continue
    }

    analysisRun = true

    // Capture DOM
    const fullUrl = `${APP_URL}${pageConfig.url}`
    const pageHtml = await capturePageDOM(page, fullUrl, pageConfig.selector)

    if (!pageHtml) {
      console.log(`  ⚠️  Could not capture DOM, skipping`)
      continue
    }

    // Analyze with AI
    const analysis = await analyzePageWithAI(
      pageConfig.name,
      fullUrl,
      pageHtml,
      existingData.behaviors || []
    )

    if (!analysis || !analysis.newElementsFound || analysis.newElementsFound.length === 0) {
      console.log(`  ℹ️  No new elements found`)

      // Update timestamp even if no new elements
      allBehaviors[pageKey] = {
        ...existingData,
        lastAnalyzedAt: new Date().toISOString(),
        lastCheckResult: 'no_new_elements'
      }
      continue
    }

    // Generate behaviors
    const newBehaviors = await generateBehaviors(analysis, pageConfig.name, fullUrl)

    if (!newBehaviors || newBehaviors.length === 0) {
      console.log(`  ⚠️  No behaviors generated`)
      allBehaviors[pageKey] = {
        ...existingData,
        lastAnalyzedAt: new Date().toISOString(),
        lastCheckResult: 'no_behaviors_generated'
      }
      continue
    }

    // Store behaviors
    allBehaviors[pageKey] = {
      pageName: pageConfig.name,
      pageUrl: fullUrl,
      behaviors: [
        ...(existingData.behaviors || []),
        ...newBehaviors.map(b => ({
          ...b,
          addedAt: new Date().toISOString(),
          timesExecuted: 0,
          successCount: 0,
          failureCount: 0,
          enabled: true, // Start enabled but at low probability
        }))
      ],
      lastAnalyzedAt: new Date().toISOString(),
      lastCheckResult: 'success',
      analysis: {
        elementsFound: analysis.newElementsFound.length,
        confidence: analysis.confidence,
        notes: analysis.notes
      }
    }

    console.log(`  ✨ Added ${newBehaviors.length} new behaviors to ${pageConfig.name}`)

    // Add throttling delay between pages to avoid rate limits
    const pageIndex = PAGES_TO_ANALYZE.indexOf(pageConfig)
    if (pageIndex < PAGES_TO_ANALYZE.length - 1) {
      console.log('  ⏳ Waiting 5 seconds before next page...')
      await page.waitForTimeout(5000)
    }
  }

  await browser.close()

  // Save all behaviors
  if (analysisRun) {
    saveAIBehaviors(allBehaviors)
    console.log(`\n✅ Phase 4 analysis complete!`)
    console.log(`   Behaviors saved to: ${AI_BEHAVIORS_FILE}`)
  } else {
    console.log(`\n⏭️  No analysis needed - all pages up to date`)
  }

  return allBehaviors
}

// ============ BEHAVIOR EXECUTION HELPERS ============

/**
 * Get behaviors for a specific page
 */
export function getBehaviorsForPage(pageName) {
  const allBehaviors = loadAIBehaviors()
  const pageKey = pageName.toLowerCase()
  return allBehaviors[pageKey]?.behaviors || []
}

/**
 * Check if a behavior should execute based on persona and probability
 */
export function shouldExecuteBehavior(behavior, persona) {
  if (!behavior.enabled) return false

  // Get probability adjusted for persona
  let probability = behavior.baseProbability || 0.1

  if (behavior.personaAdjustments && persona.activity_pattern) {
    const pattern = persona.activity_pattern.toLowerCase()
    probability = behavior.personaAdjustments[pattern] || probability
  }

  // Additional adjustments based on engagement score
  if (persona.engagement_score) {
    probability *= (persona.engagement_score / 100)
  }

  return Math.random() < probability
}

/**
 * Execute a behavior in a Playwright page
 */
export async function executeBehavior(behavior, page, persona, posthog) {
  try {
    if (DEBUG) {
      console.log(`  🎯 Executing behavior: ${behavior.name}`)
    }

    // Check trigger condition if specified
    if (behavior.triggerCondition) {
      // Evaluate condition (simplified - in production you'd parse this properly)
      // For now, just execute
    }

    // Execute the Playwright code
    // Note: This is unsafe - in production you'd need proper sandboxing
    // For now, we trust the AI-generated code since it's stored locally
    const codeFunction = new Function('page', 'persona', 'posthog', 'DEBUG', behavior.playwrightCode)
    await codeFunction(page, persona, posthog, DEBUG)

    // Track success
    behavior.timesExecuted = (behavior.timesExecuted || 0) + 1
    behavior.successCount = (behavior.successCount || 0) + 1

    // Track event if specified
    if (behavior.posthogEvent && posthog) {
      const properties = { ...behavior.posthogEvent.properties }

      // Replace placeholders
      for (const [key, value] of Object.entries(properties)) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const placeholder = value.slice(2, -2)
          properties[key] = persona[placeholder] || value
        }
      }

      posthog.capture({
        distinctId: persona.distinct_id,
        event: behavior.posthogEvent.eventName,
        properties: {
          ...properties,
          behavior_id: behavior.behaviorId,
          ai_generated: true,
        }
      })
    }

    return true
  } catch (error) {
    console.error(`  ❌ Behavior execution failed (${behavior.behaviorId}):`, error.message)
    behavior.failureCount = (behavior.failureCount || 0) + 1
    return false
  }
}

// Can run standalone for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase4Analysis().catch(console.error)
}
