// FlixBuddy Welcome Experiment Funnel
// Generates synthetic traffic for the flixbuddy_welcome_experiment with biased results
// Expected: 'suggested-prompts' wins by ~20% on message_sent

import { PostHog } from 'posthog-node'
import fs from 'node:fs'
import path from 'node:path'

const DEBUG = process.env.DEBUG === 'true'
const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const FUNNEL_COUNT = parseInt(process.env.FLIXBUDDY_FUNNEL_COUNT || '50', 10)
const EXPERIMENT_END_DATE = process.env.EXPERIMENT_END_DATE || null

// Initialize PostHog
const apiKey = process.env.POSTHOG_KEY
const host = process.env.PH_HOST || 'https://eu.i.posthog.com'

if (!apiKey) {
  console.error('❌ POSTHOG_KEY environment variable is required')
  process.exit(1)
}

console.log(`🔑 PostHog Config:`)
console.log(`   API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`)
console.log(`   Host: ${host}`)

const posthog = new PostHog(apiKey, { host })

// Experiment variants
const VARIANTS = ['control', 'suggested-prompts', 'personalized']

// Biased engagement rates (suggested-prompts wins by ~20%)
const ENGAGEMENT_RATES = {
  'control': {
    messageSent: 0.40,      // 40% send a message
    feedback: 0.25,          // 25% give feedback
    feedbackPositive: 0.60,  // 60% of feedback is positive
    videoClicked: 0.30,      // 30% click a video
    abandoned: 0.60          // 60% abandon (inverse of messageSent)
  },
  'suggested-prompts': {
    messageSent: 0.60,       // 60% send a message (WINNER - 20% higher)
    feedback: 0.35,          // 35% give feedback
    feedbackPositive: 0.70,  // 70% of feedback is positive
    videoClicked: 0.45,      // 45% click a video
    abandoned: 0.40          // 40% abandon
  },
  'personalized': {
    messageSent: 0.50,       // 50% send a message
    feedback: 0.40,          // 40% give feedback (higher engagement)
    feedbackPositive: 0.75,  // 75% of feedback is positive (feels understood)
    videoClicked: 0.35,      // 35% click a video
    abandoned: 0.50          // 50% abandon
  }
}

// Device profiles for realistic distribution
const DEVICES = [
  { type: 'Desktop', browser: 'Chrome', os: 'Windows', weight: 45 },
  { type: 'Desktop', browser: 'Safari', os: 'macOS', weight: 25 },
  { type: 'Mobile', browser: 'Safari', os: 'iOS', weight: 20 },
  { type: 'Mobile', browser: 'Chrome', os: 'Android', weight: 10 }
]

// Sample video IDs (from HogFlix catalog)
const SAMPLE_VIDEO_IDS = [
  'video-1', 'video-2', 'video-3', 'video-4', 'video-5'
]

// Prompt suggestions that users might click (for suggested-prompts variant)
const PROMPT_SUGGESTIONS = [
  "What's trending?",
  'Something funny',
  'Hidden gems',
  'New releases'
]

function weightedChoice(arr) {
  const total = arr.reduce((sum, item) => sum + item.weight, 0)
  let rand = Math.random() * total
  for (const item of arr) {
    rand -= item.weight
    if (rand <= 0) return item
  }
  return arr[0]
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateDistinctId() {
  return `flixbuddy-exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function generateProfileId() {
  return `profile-${Math.random().toString(36).substr(2, 9)}`
}

function generateConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
}

function checkExperimentExpired() {
  if (!EXPERIMENT_END_DATE) return false
  const endDate = new Date(EXPERIMENT_END_DATE)
  const now = new Date()
  return now > endDate
}

async function simulateFlixBuddySession(variant, index, total) {
  const distinctId = generateDistinctId()
  const profileId = generateProfileId()
  const conversationId = generateConversationId()
  const device = weightedChoice(DEVICES)
  const rates = ENGAGEMENT_RATES[variant]
  
  const commonProps = {
    experiment_variant: variant,
    profile_id: profileId,
    conversation_id: conversationId,
    $device_type: device.type,
    $browser: device.browser,
    $os: device.os,
    is_synthetic: true,
    synthetic_source: 'flixbuddy-experiment-funnel'
  }
  
  console.log(`[${index + 1}/${total}] ${variant} variant | ${device.type}/${device.browser}`)
  
  // 1. Track feature flag exposure (with $feature_flag_id for experiment linking)
  posthog.capture({
    distinctId,
    event: '$feature_flag_called',
    properties: {
      ...commonProps,
      $feature_flag: 'flixbuddy_welcome_experiment',
      $feature_flag_response: variant,
      $feature_flag_id: 'flixbuddy_welcome_experiment'
    }
  })
  
  // 2. Track FlixBuddy opened
  posthog.capture({
    distinctId,
    event: 'flixbuddy:opened',
    properties: {
      ...commonProps,
      initial_query: null
    }
  })
  
  // 3. Determine if user sends a message (based on biased rates)
  const sendsMessage = Math.random() < rates.messageSent
  
  if (sendsMessage) {
    // For suggested-prompts variant, 70% use a suggestion button
    const usesSuggestion = variant === 'suggested-prompts' && Math.random() < 0.70
    const messageText = usesSuggestion 
      ? randomChoice(PROMPT_SUGGESTIONS)
      : 'What should I watch tonight?'
    
    // Track prompt suggestion click if applicable
    if (usesSuggestion) {
      posthog.capture({
        distinctId,
        event: 'flixbuddy:prompt_suggestion_clicked',
        properties: {
          ...commonProps,
          prompt: messageText
        }
      })
    }
    
    // Track message sent
    posthog.capture({
      distinctId,
      event: 'flixbuddy:message_sent',
      properties: {
        ...commonProps,
        message_length: messageText.length,
        message_number: 1
      }
    })
    
    console.log(`  ✓ Message sent${usesSuggestion ? ' (via suggestion)' : ''}`)
    
    // 4. Maybe send additional messages (20-40% chance per variant)
    const additionalMessages = Math.random() < (variant === 'suggested-prompts' ? 0.40 : 0.25) ? 
      Math.floor(Math.random() * 3) + 1 : 0
    
    for (let i = 0; i < additionalMessages; i++) {
      posthog.capture({
        distinctId,
        event: 'flixbuddy:message_sent',
        properties: {
          ...commonProps,
          message_length: 20 + Math.floor(Math.random() * 50),
          message_number: i + 2
        }
      })
    }
    
    if (additionalMessages > 0) {
      console.log(`  ✓ ${additionalMessages} additional message(s)`)
    }
    
    // 5. Maybe give feedback
    if (Math.random() < rates.feedback) {
      const isPositive = Math.random() < rates.feedbackPositive
      posthog.capture({
        distinctId,
        event: 'flixbuddy:feedback',
        properties: {
          ...commonProps,
          feedback: isPositive ? 'positive' : 'negative',
          $ai_feedback: isPositive ? 1 : -1,
          message_id: `msg-${Date.now()}`
        }
      })
      console.log(`  ✓ Feedback: ${isPositive ? '👍' : '👎'}`)
    }
    
    // 6. Maybe click a video
    if (Math.random() < rates.videoClicked) {
      const videoId = randomChoice(SAMPLE_VIDEO_IDS)
      posthog.capture({
        distinctId,
        event: 'flixbuddy:clicked',
        properties: {
          ...commonProps,
          video_id: videoId
        }
      })
      console.log(`  ✓ Video clicked: ${videoId}`)
    }
    
    // 7. Track session ended (with engagement)
    const sessionDuration = 30 + Math.floor(Math.random() * 180) // 30s - 3.5min
    posthog.capture({
      distinctId,
      event: 'flixbuddy:session_ended',
      properties: {
        ...commonProps,
        message_count: 1 + additionalMessages,
        total_messages: 2 + additionalMessages * 2, // user + assistant messages
        session_duration_seconds: sessionDuration,
        videos_recommended: Math.floor(Math.random() * 4) + 1
      }
    })
    
  } else {
    // User abandoned without sending a message
    const timeOnPage = 5 + Math.floor(Math.random() * 25) // 5-30 seconds
    posthog.capture({
      distinctId,
      event: 'flixbuddy:abandoned',
      properties: {
        ...commonProps,
        time_on_page_seconds: timeOnPage
      }
    })
    console.log(`  → Abandoned after ${timeOnPage}s`)
  }
  
  return { distinctId, variant, sendsMessage }
}

async function runFlixBuddyExperimentFunnel() {
  // Check if experiment has expired
  if (checkExperimentExpired()) {
    console.log(`\n⏰ Experiment ended (EXPERIMENT_END_DATE: ${EXPERIMENT_END_DATE})`)
    console.log(`   Skipping synthetic traffic generation.`)
    return { skipped: true }
  }
  
  console.log(`\n🎯 FlixBuddy Welcome Experiment Funnel`)
  console.log(`   Feature flag: flixbuddy_welcome_experiment`)
  console.log(`   Primary metric: flixbuddy:message_sent`)
  console.log(`   Users per run: ${FUNNEL_COUNT}`)
  if (EXPERIMENT_END_DATE) {
    console.log(`   Experiment ends: ${EXPERIMENT_END_DATE}`)
  }
  console.log('')
  
  const results = {
    control: { exposures: 0, messageSent: 0, feedback: 0, videoClicked: 0, abandoned: 0 },
    'suggested-prompts': { exposures: 0, messageSent: 0, feedback: 0, videoClicked: 0, abandoned: 0 },
    personalized: { exposures: 0, messageSent: 0, feedback: 0, videoClicked: 0, abandoned: 0 }
  }

  const cohortWeek = new Date().toISOString().slice(0, 10)
  const generatedPersonas = []

  for (let i = 0; i < FUNNEL_COUNT; i++) {
    // Distribute evenly across variants (33% each)
    const variant = VARIANTS[i % 3]

    const { distinctId, sendsMessage } = await simulateFlixBuddySession(variant, i, FUNNEL_COUNT)
    generatedPersonas.push({ id: distinctId, variant, cohortWeek, createdAt: new Date().toISOString() })

    results[variant].exposures++
    if (sendsMessage) {
      results[variant].messageSent++
    } else {
      results[variant].abandoned++
    }

    // Small delay between users to avoid rate limiting
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100))
  }

  // Persist personas to STATE_DIR so returning-users script can replay them
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })
    const cohortFile = path.join(STATE_DIR, 'flixbuddy_cohort.json')
    const existing = fs.existsSync(cohortFile) ? JSON.parse(fs.readFileSync(cohortFile, 'utf8')) : []
    const existingIds = new Set(existing.map(p => p.id))
    const merged = [...existing, ...generatedPersonas.filter(p => !existingIds.has(p.id))]
    // Keep only last 90 days to avoid unbounded growth
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const pruned = merged.filter(p => p.createdAt >= cutoff)
    fs.writeFileSync(cohortFile, JSON.stringify(pruned, null, 2))
    console.log(`   💾 Saved ${generatedPersonas.length} personas to cohort pool (total: ${pruned.length})`)
  } catch (e) {
    console.warn(`   ⚠ Could not save cohort personas: ${e.message}`)
  }

  return results
}

// Main execution
;(async () => {
  try {
    const results = await runFlixBuddyExperimentFunnel()
    
    if (results.skipped) {
      await posthog.shutdown()
      process.exit(0)
    }
    
    console.log(`\n📊 FlixBuddy Experiment Summary:`)
    console.log(`   ┌─────────────────────┬───────────┬─────────────┬────────────┐`)
    console.log(`   │ Variant             │ Exposures │ Message Sent│ Rate       │`)
    console.log(`   ├─────────────────────┼───────────┼─────────────┼────────────┤`)
    
    for (const variant of VARIANTS) {
      const r = results[variant]
      const rate = r.exposures > 0 ? ((r.messageSent / r.exposures) * 100).toFixed(1) : '0.0'
      const variantPadded = variant.padEnd(19)
      const exposuresPadded = String(r.exposures).padStart(9)
      const messageSentPadded = String(r.messageSent).padStart(11)
      const ratePadded = `${rate}%`.padStart(10)
      console.log(`   │ ${variantPadded} │${exposuresPadded} │${messageSentPadded} │${ratePadded} │`)
    }
    
    console.log(`   └─────────────────────┴───────────┴─────────────┴────────────┘`)
    
    // Calculate winner
    const controlRate = results.control.messageSent / results.control.exposures
    const suggestedRate = results['suggested-prompts'].messageSent / results['suggested-prompts'].exposures
    const personalizedRate = results.personalized.messageSent / results.personalized.exposures
    
    const suggestedLift = ((suggestedRate - controlRate) / controlRate * 100).toFixed(1)
    const personalizedLift = ((personalizedRate - controlRate) / controlRate * 100).toFixed(1)
    
    console.log(`\n   📈 Lift vs Control:`)
    console.log(`      suggested-prompts: +${suggestedLift}%`)
    console.log(`      personalized: +${personalizedLift}%`)
    
    console.log(`\n   Flushing PostHog events...`)
    await posthog.flush()
    console.log(`   ✓ Events flushed`)
    await posthog.shutdown()
    console.log(`   ✓ PostHog shutdown complete`)
    
    console.log(`\n   ✓ Complete. Check PostHog experiment for new data.\n`)
    
  } catch (error) {
    console.error('Fatal error:', error)
    await posthog.shutdown()
    process.exit(1)
  }
})()