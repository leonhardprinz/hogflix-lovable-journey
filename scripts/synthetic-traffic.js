// ============= DYNAMIC SYNTHETIC TRAFFIC SYSTEM =============
// Simulates realistic user lifecycles, engagement patterns, and behavior
// Node >= 18, ESM ("type":"module")
import { PostHog } from 'posthog-node'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// ------------------ CONFIG ------------------
const PH_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com'
const PH_PROJECT_API_KEY = process.env.PH_PROJECT_API_KEY
if (!PH_PROJECT_API_KEY) {
  console.error('Missing PH_PROJECT_API_KEY')
  process.exit(1)
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kawxtrzyllgzmmwfddil.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USE_DATABASE = SUPABASE_SERVICE_KEY ? true : false

const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')
const METRICS_FILE = path.join(STATE_DIR, 'daily_metrics.json')

const TARGET_POOL_SIZE = Number(process.env.PERSONA_POOL || 400)
const DAILY_NEW_SIGNUPS = [2, 3, 4, 5] // Random choice
const MAX_FLIXBUDDY_CALLS = 50

const PLANS = ['Basic', 'Standard', 'Premium']
const PLAN_IDS = {
  'Basic': '0c3ce4bd-2eff-44ff-a649-67e631179cb1',
  'Standard': 'deb3c639-eb12-4b34-83de-6cd4335b0463',
  'Premium': 'cc6c7fe5-e14a-469c-bf78-4c393f258068'
}

const VIDEO_IDS = [
  'f0c23bb4-0b7c-41dd-9314-da2ae2b6f9bb',
  'ee7ed045-b989-4d34-86e7-c38cfab93bdf',
  'c1e7fc0a-ef55-414a-babb-cba1d41bb8e5',
  'a8366609-4fe9-4060-b023-25f2367d7c02',
  '6cec1590-1f7d-4686-bb66-03990e175a07',
  'b11e9cbe-ef3d-47c2-ba46-48dbc91c4301',
  'c390b53e-0ca4-4ad8-b837-d3628262ff8f',
  '19d8ed8c-4b56-43d5-a837-89a53968cf7a',
  '9255af02-d9d7-4d3a-8a88-1060299acee0',
  '41fe8f67-1ae7-4088-8ed5-0ea94017c25d'
]

// ============ USER LIFECYCLE STATES ============
const LIFECYCLE_STATES = {
  NEW: 'NEW',           // First 7 days, high engagement
  ACTIVE: 'ACTIVE',     // Regular users
  CASUAL: 'CASUAL',     // Infrequent but returning
  DORMANT: 'DORMANT',   // Haven't visited in 14+ days
  CHURNED: 'CHURNED'    // Lost users
}

// ============ ACTIVITY PATTERNS ============
const ACTIVITY_PATTERNS = {
  DAILY: 'DAILY',       // Power users (15%)
  REGULAR: 'REGULAR',   // Most common (40%)
  WEEKEND: 'WEEKEND',   // Weekend warriors (20%)
  BINGE: 'BINGE',       // Binge watchers (15%)
  MONTHLY: 'MONTHLY'    // Casual viewers (10%)
}

// ============ LIFE EVENTS ============
const LIFE_EVENTS = {
  VACATION: { duration: [7, 14], returnProb: 0.00, probability: 0.005 },
  SICK: { duration: [3, 5], returnProb: 0.10, probability: 0.01 },
  BUSY_WORK: { duration: [5, 10], returnProb: 0.20, probability: 0.02 },
  NEW_RELEASE_HYPE: { duration: [3, 7], returnProb: 0.95, probability: 0.01 }
}

// ============ FLIXBUDDY TEMPLATES ============
const FLIXBUDDY_QUESTIONS = [
  "What's a good action movie?",
  "I want something funny to watch",
  "Show me sci-fi movies",
  "Recommend a family-friendly movie",
  "What are the most popular shows?",
  "I'm in the mood for a thriller",
  "Any good documentaries?",
  "What should I watch tonight?"
]

// ------------------ HELPERS ------------------
const ensureDir = (p) => fs.existsSync(p) || fs.mkdirSync(p, { recursive: true })
const rand = () => Math.random()
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const randomElement = (arr) => arr[Math.floor(rand() * arr.length)]
const randomChoice = (arr) => arr[randInt(0, arr.length - 1)]

function dowFactor() {
  const day = new Date().getUTCDay()
  return [0.85, 0.9, 0.95, 1.0, 1.1, 1.15, 1.05][day]
}

function pickSourceByIndex(i) {
  const r = i % 100
  if (r < 40) return 'direct'
  if (r < 70) return 'newsletter'
  if (r < 95) return 'linkedin'
  if (r < 97) return 'organic'
  if (r < 99) return 'partner'
  return 'referral'
}

// Initialize clients
let supabase = null
if (USE_DATABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  console.log('✅ Supabase client initialized (admin mode)')
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

// ============ PERSONA MANAGEMENT ============

function createNewPersona(index) {
  const timestamp = Date.now()
  const plan = rand() < 0.6 ? 'Basic' : (rand() < 0.7 ? 'Standard' : 'Premium')
  
  return {
    distinct_id: `p_${String(index).padStart(5, '0')}_${timestamp}`,
    plan: plan,
    company_plan: plan,
    source: pickSourceByIndex(index),
    created_at: new Date().toISOString(),
    
    // Lifecycle
    state: LIFECYCLE_STATES.NEW,
    state_changed_at: new Date().toISOString(),
    days_since_signup: 0,
    last_active: null,
    
    // Activity pattern (starts as DAILY for NEW users)
    activity_pattern: ACTIVITY_PATTERNS.DAILY,
    consecutive_active_days: 0,
    consecutive_missed_days: 0,
    total_sessions: 0,
    
    // Engagement metrics
    engagement_score: randInt(85, 95),
    videos_watched: 0,
    avg_watch_completion: 0,
    ratings_given: 0,
    watchlist_size: 0,
    flixbuddy_conversations: 0,
    
    // Temporal state
    in_life_event: null,
    life_event_ends_at: null,
    binge_state: {
      is_binging: false,
      binge_day: 0,
      cooldown_until: null
    },
    
    // Churn tracking
    churned_at: null,
    churn_reason: null,
    
    // Database sync
    initialized: false,
    db_initialized: false,
    user_id: null,
    profile_id: null,
    email: null
  }
}

function loadPersonas() {
  ensureDir(STATE_DIR)
  if (fs.existsSync(PERSONAS_FILE)) {
    const arr = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
    // Migrate old personas to new schema
    arr.forEach((p, i) => {
      if (!p.state) p.state = LIFECYCLE_STATES.ACTIVE
      if (!p.activity_pattern) p.activity_pattern = ACTIVITY_PATTERNS.REGULAR
      if (!p.engagement_score) p.engagement_score = 75
      if (!p.videos_watched) p.videos_watched = 0
      if (!p.total_sessions) p.total_sessions = 0
      if (!p.consecutive_active_days) p.consecutive_active_days = 0
      if (!p.consecutive_missed_days) p.consecutive_missed_days = 0
      if (!p.binge_state) p.binge_state = { is_binging: false, binge_day: 0, cooldown_until: null }
      if (!p.flixbuddy_conversations) p.flixbuddy_conversations = 0
      if (!p.days_since_signup) p.days_since_signup = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (24 * 60 * 60 * 1000))
    })
    return arr
  }
  
  // Initial seed
  const personas = []
  for (let i = 0; i < TARGET_POOL_SIZE; i++) {
    personas.push(createNewPersona(i))
  }
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(personas, null, 2))
  return personas
}

function savePersonas(arr) {
  ensureDir(STATE_DIR)
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(arr, null, 2))
}

function saveDailyMetrics(metrics) {
  ensureDir(STATE_DIR)
  const history = fs.existsSync(METRICS_FILE) 
    ? JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'))
    : []
  history.push({ date: new Date().toISOString(), ...metrics })
  fs.writeFileSync(METRICS_FILE, JSON.stringify(history.slice(-90), null, 2)) // Keep 90 days
}

// ============ LIFECYCLE TRANSITIONS ============

function updatePersonaLifecycle(p) {
  const now = Date.now()
  const lastActive = p.last_active ? new Date(p.last_active).getTime() : null
  const daysSinceActive = lastActive ? Math.floor((now - lastActive) / (24 * 60 * 60 * 1000)) : 999
  
  p.days_since_signup++
  
  let newState = p.state
  
  // State transitions
  if (p.state === LIFECYCLE_STATES.NEW && p.days_since_signup >= 7) {
    newState = LIFECYCLE_STATES.ACTIVE
  } else if (p.state === LIFECYCLE_STATES.ACTIVE && daysSinceActive >= 14) {
    newState = LIFECYCLE_STATES.DORMANT
  } else if (p.state === LIFECYCLE_STATES.DORMANT && daysSinceActive >= 30) {
    if (rand() < 0.03) { // 3% daily churn from dormant
      newState = LIFECYCLE_STATES.CHURNED
      p.churned_at = new Date().toISOString()
      p.churn_reason = 'long_inactivity'
    }
  } else if (p.state === LIFECYCLE_STATES.DORMANT && daysSinceActive < 14) {
    newState = LIFECYCLE_STATES.ACTIVE // Reactivation
  }
  
  // Update activity pattern after 14 days for NEW users
  if (p.state === LIFECYCLE_STATES.NEW && p.days_since_signup >= 14 && p.total_sessions > 0) {
    const patterns = [
      ACTIVITY_PATTERNS.DAILY,
      ACTIVITY_PATTERNS.REGULAR,
      ACTIVITY_PATTERNS.WEEKEND,
      ACTIVITY_PATTERNS.BINGE,
      ACTIVITY_PATTERNS.MONTHLY
    ]
    const weights = p.plan === 'Premium' 
      ? [0.25, 0.45, 0.15, 0.10, 0.05]
      : p.plan === 'Standard'
      ? [0.15, 0.40, 0.20, 0.15, 0.10]
      : [0.05, 0.30, 0.25, 0.20, 0.20]
    
    const r = rand()
    let cumulative = 0
    for (let i = 0; i < patterns.length; i++) {
      cumulative += weights[i]
      if (r < cumulative) {
        p.activity_pattern = patterns[i]
        break
      }
    }
  }
  
  if (newState !== p.state) {
    p.state = newState
    p.state_changed_at = new Date().toISOString()
  }
  
  // Engagement decay for inactive users
  if (daysSinceActive > 0) {
    p.engagement_score = Math.max(0, p.engagement_score - daysSinceActive)
  }
}

function triggerLifeEvents(p) {
  // Clear expired events
  if (p.life_event_ends_at && new Date(p.life_event_ends_at) < new Date()) {
    p.in_life_event = null
    p.life_event_ends_at = null
  }
  
  // Trigger new events
  if (!p.in_life_event) {
    for (const [eventType, config] of Object.entries(LIFE_EVENTS)) {
      if (rand() < config.probability) {
        const duration = randInt(config.duration[0], config.duration[1])
        p.in_life_event = eventType
        p.life_event_ends_at = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
        break
      }
    }
  }
}

function calculateReturnProbability(p) {
  // Base probability by pattern
  const patternBase = {
    [ACTIVITY_PATTERNS.DAILY]: 0.85,
    [ACTIVITY_PATTERNS.REGULAR]: 0.45,
    [ACTIVITY_PATTERNS.WEEKEND]: 0.15,
    [ACTIVITY_PATTERNS.BINGE]: 0.05,
    [ACTIVITY_PATTERNS.MONTHLY]: 0.03
  }
  
  let prob = patternBase[p.activity_pattern] || 0.45
  
  // Weekend boost for WEEKEND pattern
  if (p.activity_pattern === ACTIVITY_PATTERNS.WEEKEND) {
    const day = new Date().getUTCDay()
    if (day === 0 || day === 6) prob += 0.70
  }
  
  // Monthly spike
  if (p.activity_pattern === ACTIVITY_PATTERNS.MONTHLY) {
    const dayOfMonth = new Date().getUTCDate()
    if (dayOfMonth <= 3) prob += 0.77
  }
  
  // Binge cycling
  if (p.activity_pattern === ACTIVITY_PATTERNS.BINGE) {
    if (p.binge_state.is_binging) {
      prob = 0.90
      p.binge_state.binge_day++
      if (p.binge_state.binge_day >= randInt(3, 7)) {
        p.binge_state.is_binging = false
        p.binge_state.binge_day = 0
        const cooldown = randInt(10, 21)
        p.binge_state.cooldown_until = new Date(Date.now() + cooldown * 24 * 60 * 60 * 1000).toISOString()
      }
    } else if (p.binge_state.cooldown_until && new Date(p.binge_state.cooldown_until) < new Date()) {
      p.binge_state.is_binging = true
      p.binge_state.cooldown_until = null
    }
  }
  
  // Life events override
  if (p.in_life_event) {
    prob = LIFE_EVENTS[p.in_life_event].returnProb
  }
  
  // Streak bonus
  if (p.consecutive_active_days >= 3) {
    prob += Math.min(0.20, Math.floor(p.consecutive_active_days / 3) * 0.05)
  }
  
  // Day of week factor
  prob *= dowFactor()
  
  // State modifiers
  if (p.state === LIFECYCLE_STATES.NEW) prob = Math.max(prob, 0.80)
  if (p.state === LIFECYCLE_STATES.DORMANT) prob *= 0.3
  if (p.state === LIFECYCLE_STATES.CHURNED) prob = 0
  
  // Engagement score influence
  prob += (p.engagement_score - 50) / 200
  
  return Math.max(0.01, Math.min(0.98, prob))
}

// ============ DATABASE OPERATIONS ============

async function initializePersonaInDatabase(p) {
  if (!USE_DATABASE || p.db_initialized) return

  try {
    const email = `${p.distinct_id}@hogflix-synthetic.test`
    const password = `synthetic_${p.distinct_id}_pass_${Date.now()}`

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: `Synthetic ${p.plan} User`,
        is_synthetic: true
      }
    })

    if (userError && !userError.message.includes('already registered')) {
      console.error(`❌ Error creating user ${p.distinct_id}:`, userError.message)
      return
    }

    const userId = userData?.user?.id || (await getUserIdByEmail(email))
    if (!userId) return

    p.user_id = userId
    p.email = email

    await supabase.from('profiles').upsert({
      id: userId,
      user_id: userId,
      email: email,
      display_name: `${p.plan}_${p.distinct_id.substring(0, 12)}`,
      is_kids_profile: false,
      marketing_opt_in: rand() > 0.5
    }, { onConflict: 'user_id' })

    const planId = PLAN_IDS[p.plan]
    const daysAgo = Math.min(p.days_since_signup, 90)
    const startedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      plan_id: planId,
      status: p.state === LIFECYCLE_STATES.CHURNED ? 'expired' : 'active',
      started_at: startedAt
    }, { onConflict: 'user_id' })

    p.db_initialized = true
    console.log(`✅ Initialized ${p.distinct_id} in database`)

  } catch (error) {
    console.error(`❌ Failed to initialize ${p.distinct_id}:`, error.message)
  }
}

async function getUserIdByEmail(email) {
  try {
    const { data } = await supabase.auth.admin.listUsers()
    const user = data?.users?.find(u => u.email === email)
    return user?.id
  } catch (error) {
    return null
  }
}

async function getProfileId(userId) {
  try {
    const { data } = await supabase.from('profiles').select('id').eq('user_id', userId).single()
    return data?.id
  } catch {
    return null
  }
}

// ============ BEHAVIOR SIMULATION ============

async function simulateWatchProgress(p, videoId, sessionDepth) {
  if (!USE_DATABASE || !p.user_id || !p.profile_id) return

  try {
    const duration = 3600
    
    // Completion varies by state
    let completionMean = 0.60
    if (p.state === LIFECYCLE_STATES.NEW) completionMean = 0.45
    if (p.state === LIFECYCLE_STATES.ACTIVE) completionMean = 0.65
    if (p.binge_state.is_binging) completionMean = 0.85
    
    const progressPct = Math.max(10, Math.min(100, completionMean * 100 + (rand() - 0.5) * 40))
    const progressSec = Math.floor((progressPct / 100) * duration)

    await supabase.from('watch_progress').upsert({
      user_id: p.user_id,
      profile_id: p.profile_id,
      video_id: videoId,
      progress_seconds: progressSec,
      duration_seconds: duration,
      progress_percentage: progressPct,
      completed: progressPct >= 90,
      last_watched_at: new Date().toISOString()
    }, { onConflict: 'user_id,profile_id,video_id' })

    p.videos_watched++
    p.avg_watch_completion = ((p.avg_watch_completion * (p.videos_watched - 1)) + progressPct) / p.videos_watched

  } catch (error) {
    console.error(`Watch progress error for ${p.distinct_id}:`, error.message)
  }
}

async function simulateVideoRating(p, videoId) {
  if (!USE_DATABASE || !p.user_id || !p.profile_id) return
  if (rand() > 0.20) return // 20% rate

  try {
    const ratingProfiles = {
      'Basic': { mean: 3.2, std: 1.2 },
      'Standard': { mean: 3.8, std: 1.0 },
      'Premium': { mean: 4.2, std: 0.8 }
    }
    const profile = ratingProfiles[p.plan] || { mean: 3.5, std: 1.0 }
    const rating = Math.max(1, Math.min(5, Math.round(profile.mean + (rand() - 0.5) * 2 * profile.std)))

    await supabase.from('video_ratings').upsert({
      user_id: p.user_id,
      profile_id: p.profile_id,
      video_id: videoId,
      rating: rating
    }, { onConflict: 'video_id,profile_id' })

    p.ratings_given++

  } catch (error) {
    console.error(`Rating error for ${p.distinct_id}:`, error.message)
  }
}

async function simulateWatchlistAddition(p, videoId) {
  if (!USE_DATABASE || !p.user_id || !p.profile_id) return
  if (rand() > 0.30) return // 30% add

  try {
    await supabase.from('user_watchlist').insert({
      user_id: p.user_id,
      profile_id: p.profile_id,
      video_id: videoId
    })
    p.watchlist_size++
  } catch (error) {
    // Ignore duplicate errors
  }
}

async function simulateSupportTicket(p) {
  if (!USE_DATABASE || !p.user_id) return
  if (rand() > 0.02) return // 2% chance

  try {
    const categories = ['playback_issues', 'account_billing', 'content_request', 'technical_support', 'other']
    const descriptions = [
      'Video playback keeps buffering',
      'Need help with payment',
      'More sci-fi content please',
      'App crashes on mobile',
      'Subscription question'
    ]

    await supabase.from('support_tickets').insert({
      user_id: p.user_id,
      issue_category: randomElement(categories),
      description: randomElement(descriptions),
      status: 'open'
    })
  } catch (error) {
    // Ignore rate limit errors
  }
}

async function simulateFlixBuddy(p, flixbuddyCallCount) {
  if (!USE_DATABASE || !p.user_id || !p.profile_id) return null
  if (rand() > 0.10) return null // 10% engage with FlixBuddy
  if (flixbuddyCallCount >= MAX_FLIXBUDDY_CALLS) return null

  try {
    // Create conversation
    const { data: conv } = await supabase.from('chat_conversations').insert({
      user_id: p.user_id,
      profile_id: p.profile_id,
      title: 'FlixBuddy Chat'
    }).select().single()

    if (!conv) return null

    const question = randomElement(FLIXBUDDY_QUESTIONS)
    
    // Save user message
    await supabase.from('chat_messages').insert({
      conversation_id: conv.id,
      role: 'user',
      content: question
    })

    // Call FlixBuddy edge function
    const { data: response } = await supabase.functions.invoke('flixbuddy-chat', {
      body: { 
        messages: [{ role: 'user', content: question }],
        conversationId: conv.id 
      }
    })

    if (response?.content) {
      await supabase.from('chat_messages').insert({
        conversation_id: conv.id,
        role: 'assistant',
        content: response.content
      })
    }

    p.flixbuddy_conversations++
    
    // Track in PostHog with device/browser properties
    await posthog.capture({
      distinctId: p.distinct_id,
      event: 'flixbuddy_interaction',
      properties: {
        plan: p.plan,
        is_synthetic: true,
        question: question,
        conversation_id: conv.id,
        $browser: p.browser,
        $device_type: p.device_type,
        $os: p.os
      }
    })

    return conv.id

  } catch (error) {
    console.error(`FlixBuddy error for ${p.distinct_id}:`, error.message)
    return null
  }
}

// ============ NAVIGATION & ENGAGEMENT ============

async function simulateSession(p, flixbuddyCallCount) {
  // Determine session depth based on state
  let sessionDepth = 2
  if (p.state === LIFECYCLE_STATES.NEW) sessionDepth = randInt(3, 8)
  else if (p.state === LIFECYCLE_STATES.ACTIVE) sessionDepth = randInt(2, 5)
  else if (p.binge_state.is_binging) sessionDepth = randInt(5, 15)
  else sessionDepth = randInt(1, 3)

  // Entry point
  const entryPoints = ['homepage', 'search', 'category', 'watchlist', 'flixbuddy']
  const entryWeights = [0.40, 0.15, 0.20, 0.15, 0.10]
  const r = rand()
  let cumulative = 0
  let entryPoint = 'homepage'
  for (let i = 0; i < entryPoints.length; i++) {
    cumulative += entryWeights[i]
    if (r < cumulative) {
      entryPoint = entryPoints[i]
      break
    }
  }

  // PostHog entry event with device/browser properties
  await posthog.capture({
    distinctId: p.distinct_id,
    event: 'page_view',
    properties: {
      plan: p.plan,
      is_synthetic: true,
      source: p.source,
      page: entryPoint,
      state: p.state,
      pattern: p.activity_pattern,
      $browser: p.browser,
      $browser_version: p.browser_version,
      $device_type: p.device_type,
      $os: p.os,
      $screen_width: p.screen_width,
      $screen_height: p.screen_height
    }
  })

  // FlixBuddy interaction
  if (entryPoint === 'flixbuddy') {
    await simulateFlixBuddy(p, flixbuddyCallCount)
    flixbuddyCallCount++
  }

  // Navigate and watch videos
  for (let i = 0; i < sessionDepth; i++) {
    const videoId = randomElement(VIDEO_IDS)

    if (rand() < 0.75) {
      await posthog.capture({
        distinctId: p.distinct_id,
        event: 'title_opened',
        properties: { 
          plan: p.plan, 
          is_synthetic: true, 
          title_id: videoId,
          $browser: p.browser,
          $device_type: p.device_type,
          $os: p.os
        }
      })

      if (rand() < 0.60) {
        await posthog.capture({
          distinctId: p.distinct_id,
          event: 'video_started',
          properties: { 
            plan: p.plan, 
            is_synthetic: true, 
            video_id: videoId,
            $browser: p.browser,
            $device_type: p.device_type,
            $os: p.os
          }
        })

        if (USE_DATABASE && p.db_initialized && p.profile_id) {
          await simulateWatchProgress(p, videoId, sessionDepth)
          await simulateVideoRating(p, videoId)
          await simulateWatchlistAddition(p, videoId)
        }

        if (rand() < 0.55) {
          await posthog.capture({
            distinctId: p.distinct_id,
            event: 'video_progress',
            properties: { 
              plan: p.plan, 
              is_synthetic: true, 
              video_id: videoId, 
              milestone: 50,
              $browser: p.browser,
              $device_type: p.device_type,
              $os: p.os
            }
          })
        }
      }
    }
  }

  // Support tickets
  await simulateSupportTicket(p)

  return flixbuddyCallCount
}

// ============ CHURN & CLEANUP ============

async function cleanupChurnedUser(p) {
  if (!USE_DATABASE || !p.user_id) return
  
  try {
    // Delete from database tables
    await supabase.from('watch_progress').delete().eq('user_id', p.user_id)
    await supabase.from('video_ratings').delete().eq('user_id', p.user_id)
    await supabase.from('user_watchlist').delete().eq('user_id', p.user_id)
    await supabase.from('chat_messages').delete().eq('conversation_id', p.user_id)
    await supabase.from('chat_conversations').delete().eq('user_id', p.user_id)
    await supabase.from('user_subscriptions').delete().eq('user_id', p.user_id)
    await supabase.from('profiles').delete().eq('user_id', p.user_id)
    
    // Delete auth user
    await supabase.auth.admin.deleteUser(p.user_id)
    
    console.log(`🗑️  Cleaned up churned user ${p.distinct_id}`)
  } catch (error) {
    console.error(`Error cleaning up ${p.distinct_id}:`, error.message)
  }
}

// ============ MAIN EXECUTION ============

async function main() {
  console.log('🚀 Starting DYNAMIC synthetic traffic generation...')
  console.log(`📊 Database mode: ${USE_DATABASE ? 'ENABLED' : 'DISABLED'}`)

  let personas = loadPersonas()
  console.log(`👥 Loaded ${personas.length} personas`)

  // ===== PHASE 1: STATE UPDATES =====
  console.log('\n📈 Updating persona lifecycles...')
  for (const p of personas) {
    updatePersonaLifecycle(p)
    triggerLifeEvents(p)
  }

  // ===== PHASE 2: CHURN MANAGEMENT =====
  const churned = personas.filter(p => p.state === LIFECYCLE_STATES.CHURNED)
  console.log(`⚠️  Found ${churned.length} churned users`)

  if (USE_DATABASE && churned.length > 0) {
    // Clean up 90% of churned users
    const toClean = churned.slice(0, Math.floor(churned.length * 0.9))
    for (const p of toClean) {
      await cleanupChurnedUser(p)
    }
    personas = personas.filter(p => !toClean.includes(p))
  }

  // ===== PHASE 3: NEW SIGNUPS =====
  const newSignupsCount = randomChoice(DAILY_NEW_SIGNUPS)
  const currentSize = personas.length
  const needed = Math.max(0, TARGET_POOL_SIZE - currentSize)
  const actualNew = Math.min(newSignupsCount, needed)

  if (actualNew > 0) {
    console.log(`✨ Creating ${actualNew} new signups...`)
    for (let i = 0; i < actualNew; i++) {
      personas.push(createNewPersona(currentSize + i))
    }
  }

  // ===== PHASE 4: DATABASE INITIALIZATION =====
  if (USE_DATABASE) {
    const needsInit = personas.filter(p => !p.db_initialized)
    if (needsInit.length > 0) {
      console.log(`🔧 Initializing ${needsInit.length} personas in database...`)
      const batchSize = 5
      for (let i = 0; i < needsInit.length; i += batchSize) {
        const batch = needsInit.slice(i, i + batchSize)
        await Promise.all(batch.map(p => initializePersonaInDatabase(p)))
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Ensure profile_id is set
    for (const p of personas.filter(p => p.db_initialized && !p.profile_id)) {
      p.profile_id = await getProfileId(p.user_id)
    }
  }

  // ===== PHASE 5: POSTHOG IDENTIFICATION =====
  await Promise.all(personas.map(p => posthog.identify({
    distinctId: p.distinct_id,
    properties: {
      email: p.email,
      plan: p.plan,
      state: p.state,
      pattern: p.activity_pattern,
      days_since_signup: p.days_since_signup,
      engagement_score: p.engagement_score,
      is_synthetic: true,
      source: p.source,
      $browser: p.browser,
      $browser_version: p.browser_version,
      $device_type: p.device_type,
      $os: p.os,
      $screen_width: p.screen_width,
      $screen_height: p.screen_height,
      $initial_utm_source: p.utm_source || p.source,
      $initial_utm_medium: p.utm_medium || 'synthetic',
      $initial_utm_campaign: p.utm_campaign || 'hogflix-dynamic'
    }
  })))

  // ===== PHASE 6: ACTIVITY SIMULATION =====
  console.log('\n🎬 Simulating user sessions...')
  let activeCount = 0
  let flixbuddyCallCount = 0

  for (const p of personas) {
    if (p.state === LIFECYCLE_STATES.CHURNED) continue

    const returnProb = calculateReturnProbability(p)
    const isActive = rand() < returnProb

    if (isActive) {
      activeCount++
      p.total_sessions++
      p.last_active = new Date().toISOString()
      p.consecutive_active_days++
      p.consecutive_missed_days = 0
      p.engagement_score = Math.min(100, p.engagement_score + 2)

      flixbuddyCallCount = await simulateSession(p, flixbuddyCallCount)
    } else {
      p.consecutive_missed_days++
      if (p.consecutive_active_days >= 7) {
        p.engagement_score = Math.max(0, p.engagement_score - 10) // Streak break penalty
      }
      p.consecutive_active_days = 0
    }
  }

  // ===== PHASE 7: METRICS & CLEANUP =====
  const stateDistribution = {}
  const patternDistribution = {}
  personas.forEach(p => {
    stateDistribution[p.state] = (stateDistribution[p.state] || 0) + 1
    patternDistribution[p.activity_pattern] = (patternDistribution[p.activity_pattern] || 0) + 1
  })

  const metrics = {
    total_personas: personas.length,
    active_today: activeCount,
    new_signups: actualNew,
    churned_cleaned: churned.length,
    flixbuddy_calls: flixbuddyCallCount,
    state_distribution: stateDistribution,
    pattern_distribution: patternDistribution
  }

  saveDailyMetrics(metrics)
  await posthog.flush()
  await posthog.shutdown()
  savePersonas(personas)

  console.log(`\n✅ Dynamic synthetic traffic complete!`)
  console.log(`   - Active users: ${activeCount}/${personas.length}`)
  console.log(`   - New signups: ${actualNew}`)
  console.log(`   - FlixBuddy calls: ${flixbuddyCallCount}`)
  console.log(`   - States: ${JSON.stringify(stateDistribution)}`)
  console.log(`   - Patterns: ${JSON.stringify(patternDistribution)}`)
}

main().catch(async (e) => {
  console.error('❌ Error:', e)
  try { await posthog.shutdown() } catch {}
  process.exit(1)
})
