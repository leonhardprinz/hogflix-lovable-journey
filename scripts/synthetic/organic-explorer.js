// ============= ORGANIC SITE EXPLORER =============
// Synthetic users that navigate naturally, discovering pages and features

import { chromium } from 'playwright'
import { PostHog } from 'posthog-node'
import { discoverRoutes, getRouteMetadata, getNavigationSuggestions } from './route-discovery.js'
import { generateSessionTimestamp, generateEventTimestamp } from './temporal-distribution.js'

const APP_URL = process.env.APP_URL || 'https://hogflix-demo.lovable.app'
const SUPABASE_URL = 'https://kawxtrzyllgzmmwfddil.supabase.co'
const DEBUG = process.env.DEBUG === 'true'

// Initialize PostHog
const posthog = new PostHog(
  process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
  { host: 'https://eu.i.posthog.com' }
)

// ============ LINK EXTRACTION ============

async function extractLinks(page, currentUrl) {
  try {
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'))
      return anchors.map(a => ({
        href: a.getAttribute('href'),
        text: a.textContent?.trim() || '',
        className: a.className,
        isNav: a.closest('nav') !== null,
        isButton: a.classList.contains('button') || a.closest('button') !== null,
      })).filter(link => 
        link.href && 
        link.href.startsWith('/') && 
        !link.href.startsWith('/#') &&
        link.text.length > 0 &&
        link.text.length < 100
      )
    })

    // Deduplicate and prioritize
    const unique = []
    const seen = new Set()
    
    for (const link of links) {
      if (!seen.has(link.href)) {
        seen.add(link.href)
        unique.push({
          ...link,
          type: link.isNav ? 'navigation' : link.isButton ? 'cta' : 'content',
          priority: link.isButton ? 'high' : link.isNav ? 'medium' : 'low'
        })
      }
    }

    return unique
  } catch (error) {
    console.error('  ❌ Error extracting links:', error.message)
    return []
  }
}

// ============ AI JOURNEY DECISION ============

async function getJourneyDecision(persona, currentPage, availableLinks, visitedPages, sessionGoal) {
  try {
    if (DEBUG) {
      console.log(`  🤔 Asking AI for navigation decision...`)
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-organic-journey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        persona,
        currentPage,
        availableLinks: availableLinks.slice(0, 15), // Limit to avoid token limits
        visitedPages,
        sessionGoal,
      })
    })

    if (!response.ok) {
      throw new Error(`AI decision failed: ${response.status}`)
    }

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Decision failed')
    }

    return result.decision

  } catch (error) {
    console.error('  ❌ AI decision error:', error.message)
    
    // Fallback: random link with preference for navigation
    const navLinks = availableLinks.filter(l => l.type === 'navigation')
    if (navLinks.length > 0) {
      return {
        action: 'navigate',
        target: navLinks[Math.floor(Math.random() * navLinks.length)].href,
        reasoning: 'Fallback to random navigation link',
        confidence: 0.3,
        estimatedDuration: 3000,
      }
    }
    
    // End session if no good options
    return {
      action: 'end',
      reasoning: 'No navigation options available',
      confidence: 0.5,
      estimatedDuration: 0,
    }
  }
}

// ============ ORGANIC EXPLORATION SESSION ============

export async function runOrganicExploration(persona, maxDepth = 10) {
  console.log(`\n🌐 Starting organic exploration for ${persona.distinct_id}`)
  console.log(`   Pattern: ${persona.activity_pattern}, Engagement: ${persona.engagement_score}`)

  // Generate session timestamp for temporal distribution
  const sessionStart = generateSessionTimestamp(persona, persona.total_sessions || 0)
  const sessionDuration = persona.session_duration_avg || 30
  let eventIndex = 0

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Helper to capture events with timestamp
  const capture = async (event, properties) => {
    const timestamp = generateEventTimestamp(sessionStart, eventIndex++, maxDepth * 3, sessionDuration)
    await posthog.capture({
      distinctId: persona.distinct_id,
      event,
      properties: {
        ...properties,
        synthetic_timestamp: timestamp.toISOString(),
        synthetic_hour_utc: timestamp.getUTCHours()
      },
      timestamp
    })
  }

  const visitedPages = []
  const sessionEvents = []
  let currentDepth = 0
  let sessionGoal = determineSessionGoal(persona)

  console.log(`   Goal: ${sessionGoal}`)

  try {
    // Start at home page
    let currentUrl = '/'
    
    while (currentDepth < maxDepth) {
      const fullUrl = `${APP_URL}${currentUrl}`
      
      console.log(`\n  [${currentDepth + 1}/${maxDepth}] Navigating to: ${currentUrl}`)
      
      // Navigate to page
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1500 + Math.random() * 1500)

      visitedPages.push(currentUrl)
      currentDepth++

      // Track page view with timestamp
      await capture('$pageview', {
        $current_url: fullUrl,
        $browser: persona.browser || 'Chrome',
        $device_type: persona.device_type || 'Desktop',
        is_synthetic: true,
        organic_exploration: true,
        session_depth: currentDepth,
        session_goal: sessionGoal,
      })

      sessionEvents.push({
        type: 'pageview',
        url: currentUrl,
        timestamp: new Date().toISOString(),
      })

      // Get page metadata
      const metadata = getRouteMetadata(currentUrl)
      
      // Wait for typical duration on this page type
      const dwell = metadata.typicalDuration * (0.7 + Math.random() * 0.6) // Randomize ±30%
      await page.waitForTimeout(Math.min(dwell, 10000)) // Cap at 10s for speed

      // Extract available links
      const availableLinks = await extractLinks(page, currentUrl)
      
      if (DEBUG) {
        console.log(`  📍 Found ${availableLinks.length} navigation options`)
      }

      if (availableLinks.length === 0) {
        console.log(`  🚫 No links found, ending session`)
        break
      }

      // Get AI decision for next move
      const decision = await getJourneyDecision(
        persona,
        currentUrl,
        availableLinks,
        visitedPages,
        sessionGoal
      )

      console.log(`  💭 Decision: ${decision.action} - ${decision.reasoning}`)

      // Track decision event with timestamp
      await capture('organic:navigation_decision', {
        current_page: currentUrl,
        action: decision.action,
        target: decision.target,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        session_depth: currentDepth,
        is_synthetic: true,
      })

      // Execute decision
      if (decision.action === 'end') {
        console.log(`  🏁 Ending session: ${decision.reasoning}`)
        break
      } else if (decision.action === 'navigate') {
        // Update current URL and continue loop
        currentUrl = decision.target
        
        // Update goal if provided
        if (decision.nextGoal) {
          sessionGoal = decision.nextGoal
        }
      } else if (decision.action === 'interact') {
        // Simulate interaction on current page
        console.log(`  🎯 Interacting: ${decision.target}`)
        await page.waitForTimeout(decision.estimatedDuration || 2000)
        
        // Track interaction with timestamp
        await capture('organic:page_interaction', {
          page: currentUrl,
          interaction: decision.target,
          is_synthetic: true,
        })
      }

      // Safety check: don't revisit same page too many times
      const visitCount = visitedPages.filter(p => p === currentUrl).length
      if (visitCount > 2) {
        console.log(`  🔄 Already visited ${currentUrl} ${visitCount} times, ending session`)
        break
      }
    }

    console.log(`\n  ✅ Session complete: visited ${visitedPages.length} pages`)
    
    // Track session summary with timestamp
    await capture('organic:session_complete', {
      pages_visited: visitedPages.length,
      session_goal: sessionGoal,
      goal_achieved: evaluateGoalAchievement(sessionGoal, visitedPages),
      duration_minutes: sessionEvents.length * 0.5, // Rough estimate
      is_synthetic: true,
    })

    return {
      success: true,
      visitedPages,
      sessionEvents,
      pagesExplored: visitedPages.length,
    }

  } catch (error) {
    console.error(`  ❌ Exploration error:`, error.message)
    return {
      success: false,
      error: error.message,
      visitedPages,
    }
  } finally {
    await browser.close()
  }
}

// ============ HELPER FUNCTIONS ============

function determineSessionGoal(persona) {
  const goals = []

  // Based on persona state
  if (persona.state === 'NEW') {
    goals.push('Discover platform features', 'Explore content catalog', 'Consider subscription')
  } else if (persona.state === 'ACTIVE') {
    goals.push('Find content to watch', 'Manage watchlist', 'Try new features')
  } else if (persona.state === 'CASUAL') {
    goals.push('Quick content check', 'Watch saved videos')
  }

  // Based on activity pattern
  if (persona.activity_pattern === 'DAILY') {
    goals.push('Explore advanced features', 'Try FlixBuddy', 'Check for new content')
  } else if (persona.activity_pattern === 'BINGE') {
    goals.push('Find binge-worthy content', 'Build watchlist')
  }

  // Based on plan
  if (persona.plan === 'Basic') {
    goals.push('Consider upgrade options', 'Check premium features')
  }

  return goals[Math.floor(Math.random() * goals.length)] || 'Explore platform'
}

function evaluateGoalAchievement(goal, visitedPages) {
  const goalKeywords = {
    'discover': ['/browse', '/faq', '/help'],
    'content': ['/browse', '/my-list'],
    'subscription': ['/pricing', '/checkout'],
    'features': ['/flixbuddy', '/beta-features'],
    'upgrade': ['/pricing', '/checkout'],
  }

  for (const [keyword, relevantPages] of Object.entries(goalKeywords)) {
    if (goal.toLowerCase().includes(keyword)) {
      return visitedPages.some(page => relevantPages.includes(page))
    }
  }

  // Default: achieved if visited multiple pages
  return visitedPages.length >= 3
}

// ============ BATCH EXECUTION ============

export async function runOrganicExplorers(personas, count = 10) {
  console.log(`\n🚀 Running ${count} organic exploration sessions...`)

  const selectedPersonas = personas
    .filter(p => p.state !== 'CHURNED' && p.db_initialized)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)

  const results = []

  for (let i = 0; i < selectedPersonas.length; i++) {
    const persona = selectedPersonas[i]
    console.log(`\n[${i + 1}/${selectedPersonas.length}] Persona: ${persona.distinct_id}`)
    
    // Determine exploration depth based on persona
    const maxDepth = persona.activity_pattern === 'DAILY' ? 8 :
                     persona.activity_pattern === 'CASUAL' ? 3 :
                     persona.activity_pattern === 'BINGE' ? 5 : 5

    const result = await runOrganicExploration(persona, maxDepth)
    results.push({
      persona: persona.distinct_id,
      ...result
    })

    // Small delay between sessions
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  // Flush PostHog events
  await posthog.flush()

  console.log(`\n✅ Organic exploration complete!`)
  console.log(`   Total sessions: ${results.length}`)
  console.log(`   Successful: ${results.filter(r => r.success).length}`)
  console.log(`   Total pages explored: ${results.reduce((sum, r) => sum + (r.pagesExplored || 0), 0)}`)

  return results
}
