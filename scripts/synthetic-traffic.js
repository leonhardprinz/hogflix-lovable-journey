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

// Supabase config for database operations
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kawxtrzyllgzmmwfddil.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USE_DATABASE = SUPABASE_SERVICE_KEY ? true : false

const STATE_DIR = process.env.STATE_DIR || '.synthetic_state'
const PERSONAS_FILE = path.join(STATE_DIR, 'personas.json')

const PLAN_PROP = 'plan'
const ALT_PLAN_PROP = 'company_plan'

const PLANS = ['Standard', 'Premium', 'Basic']

// Plan IDs from database
const PLAN_IDS = {
  'Basic': '0c3ce4bd-2eff-44ff-a649-67e631179cb1',
  'Standard': 'deb3c639-eb12-4b34-83de-6cd4335b0463',
  'Premium': 'cc6c7fe5-e14a-469c-bf78-4c393f258068'
}

// Available videos for simulation
const VIDEO_IDS = [
  'f0c23bb4-0b7c-41dd-9314-da2ae2b6f9bb', // InterHogStellar
  'ee7ed045-b989-4d34-86e7-c38cfab93bdf', // AvengerHogs
  'c1e7fc0a-ef55-414a-babb-cba1d41bb8e5', // Star Hog Wars
  'a8366609-4fe9-4060-b023-25f2367d7c02', // Lord of the Hogs
  '6cec1590-1f7d-4686-bb66-03990e175a07', // Frozen Hogs
  'b11e9cbe-ef3d-47c2-ba46-48dbc91c4301', // Late Night
  'c390b53e-0ca4-4ad8-b837-d3628262ff8f', // Hog Potter
  '19d8ed8c-4b56-43d5-a837-89a53968cf7a', // The Martian Hog
  '9255af02-d9d7-4d3a-8a88-1060299acee0', // Saving Private Hog
  '41fe8f67-1ae7-4088-8ed5-0ea94017c25d'  // The HogFather
]

// mixture similar to your earlier source lines
function pickSourceByIndex(i) {
  const r = i % 100
  if (r < 40) return 'direct'
  if (r < 70) return 'newsletter'
  if (r < 95) return 'linkedin'
  if (r < 97) return 'organic'
  if (r < 99) return 'partner'
  return 'referral'
}

// baseline daily return probability by plan
const BASE_RETURN = { Standard: 0.32, Premium: 0.52, Basic: 0.22 }

// video behavior probabilities
const P_OPEN_TITLE = 0.75
const P_START_VIDEO = 0.60
const P_REACH_50 = 0.55
const P_PLAN_SELECTED = 0.01

// Phase 2: Behavior probabilities
const P_ADD_WATCHLIST = 0.30      // 30% of active users add to watchlist
const P_RATE_VIDEO = 0.20         // 20% of viewers rate
const P_SUPPORT_TICKET = 0.02     // 2% chance per active session

// Example content id
const VIDEO_ID = '6f4d68aa-3d28-43eb-a16d-31848741832b'

// ------------------ HELPERS ------------------
const ensureDir = (p) => fs.existsSync(p) || fs.mkdirSync(p, { recursive: true })
const rand = () => Math.random()

function dowFactor(d) {
  const day = new Date().getUTCDay()
  return [0.85, 0.9, 0.95, 1.0, 1.1, 1.15, 1.05][day]
}

function randomElement(arr) {
  return arr[Math.floor(rand() * arr.length)]
}

// Initialize Supabase client (admin mode)
let supabase = null
if (USE_DATABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  console.log('✅ Supabase client initialized (admin mode)')
}

function loadPersonas(pool = Number(process.env.PERSONA_POOL || 400)) {
  ensureDir(STATE_DIR)
  if (fs.existsSync(PERSONAS_FILE)) {
    const arr = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
    // enrich missing fields for older files
    arr.forEach((p, i) => {
      if (!p.source) p.source = pickSourceByIndex(i)
      if (!p[PLAN_PROP]) p[PLAN_PROP] = PLANS[i % PLANS.length]
      if (p.return_prob == null) p.return_prob = BASE_RETURN[p[PLAN_PROP]] + (rand() - 0.5) * 0.08
      if (!p.created_at) p.created_at = new Date().toISOString()
      if (p.initialized == null) p.initialized = false
      if (p.db_initialized == null) p.db_initialized = false
    })
    fs.writeFileSync(PERSONAS_FILE, JSON.stringify(arr, null, 2))
    return arr
  }
  const personas = []
  for (let i = 0; i < pool; i++) {
    const plan = PLANS[i % PLANS.length]
    personas.push({
      distinct_id: `p_${String(i).padStart(5, '0')}`,
      [PLAN_PROP]: plan,
      [ALT_PLAN_PROP]: plan,
      source: pickSourceByIndex(i),
      return_prob: BASE_RETURN[plan] + (rand() - 0.5) * 0.08,
      created_at: new Date().toISOString(),
      initialized: false,
      db_initialized: false,
    })
  }
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(personas, null, 2))
  return personas
}

function savePersonas(arr) {
  ensureDir(STATE_DIR)
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(arr, null, 2))
}

const posthog = new PostHog(PH_PROJECT_API_KEY, { host: PH_HOST })

async function identifyIfNeeded(p) {
  await posthog.identify({
    distinctId: p.distinct_id,
    properties: {
      [PLAN_PROP]: p[PLAN_PROP],
      [ALT_PLAN_PROP]: p[ALT_PLAN_PROP],
      acq_source: p.source,
      is_synthetic: true,
      $initial_utm_source: p.source,
      $initial_utm_medium: 'synthetic',
      $initial_utm_campaign: 'hogflix-bot',
    },
  })
}

function eventPropsBase(p) {
  return {
    [PLAN_PROP]: p[PLAN_PROP],
    [ALT_PLAN_PROP]: p[ALT_PLAN_PROP],
    is_synthetic: true,
    source: p.source,
    $utm_source: p.source,
    $utm_medium: 'synthetic',
    $utm_campaign: 'hogflix-bot',
  }
}

// ------------------ PHASE 1: DATABASE OPERATIONS ------------------

async function initializePersonaInDatabase(p) {
  if (!USE_DATABASE || p.db_initialized) return

  try {
    const email = `${p.distinct_id}@hogflix-synthetic.test`
    const password = `synthetic_${p.distinct_id}_pass_${Date.now()}`

    // Create user via admin API
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: `Synthetic ${p[PLAN_PROP]} User`,
        is_synthetic: true
      }
    })

    if (userError && !userError.message.includes('already registered')) {
      console.error(`❌ Error creating user ${p.distinct_id}:`, userError.message)
      return
    }

    const userId = userData?.user?.id || (await getUserIdByEmail(email))
    if (!userId) {
      console.error(`❌ Could not get user ID for ${email}`)
      return
    }

    p.user_id = userId
    p.email = email

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        user_id: userId,
        email: email,
        display_name: `${p[PLAN_PROP]}_${p.distinct_id}`,
        is_kids_profile: false,
        marketing_opt_in: rand() > 0.5
      }, { onConflict: 'user_id' })

    if (profileError && !profileError.message.includes('duplicate')) {
      console.error(`❌ Profile error for ${p.distinct_id}:`, profileError.message)
    }

    // Create subscription
    const planId = PLAN_IDS[p[PLAN_PROP]]
    const daysAgo = Math.floor(rand() * 90) // Random start date in last 90 days
    const startedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    const { error: subError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_id: planId,
        status: rand() > 0.1 ? 'active' : 'expired', // 10% expired for churn
        started_at: startedAt
      }, { onConflict: 'user_id' })

    if (subError && !subError.message.includes('duplicate')) {
      console.error(`❌ Subscription error for ${p.distinct_id}:`, subError.message)
    }

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
    console.error('Error finding user:', error.message)
    return null
  }
}

// ------------------ PHASE 2: BEHAVIOR SIMULATION ------------------

async function simulateWatchlistAddition(p, videoId) {
  if (!USE_DATABASE || !p.user_id || !p.profile_id) return

  try {
    const { error } = await supabase
      .from('user_watchlist')
      .insert({
        user_id: p.user_id,
        profile_id: p.profile_id,
        video_id: videoId
      })

    if (error && !error.message.includes('duplicate')) {
      console.error(`Watchlist error for ${p.distinct_id}:`, error.message)
    }
  } catch (error) {
    console.error(`Failed watchlist add for ${p.distinct_id}:`, error.message)
  }
}

async function simulateVideoRating(p, videoId) {
  if (!USE_DATABASE || !p.user_id || !p.profile_id) return

  try {
    // Rating distribution: higher for Premium users, normal distribution 1-5
    const baseMean = { 'Basic': 3.2, 'Standard': 3.8, 'Premium': 4.2 }[p[PLAN_PROP]] || 3.5
    const rating = Math.max(1, Math.min(5, Math.round(baseMean + (rand() - 0.5) * 2)))

    const { error } = await supabase
      .from('video_ratings')
      .upsert({
        user_id: p.user_id,
        profile_id: p.profile_id,
        video_id: videoId,
        rating: rating
      }, { onConflict: 'video_id,profile_id' })

    if (error) {
      console.error(`Rating error for ${p.distinct_id}:`, error.message)
    }
  } catch (error) {
    console.error(`Failed rating for ${p.distinct_id}:`, error.message)
  }
}

async function simulateWatchProgress(p, videoId) {
  if (!USE_DATABASE || !p.user_id || !p.profile_id) return

  try {
    const duration = 3600 // Assume 1 hour videos
    const progressPct = rand() < 0.3 ? rand() * 100 : (50 + rand() * 50) // 30% partial, 70% >50%
    const progressSec = Math.floor((progressPct / 100) * duration)

    const { error } = await supabase
      .from('watch_progress')
      .upsert({
        user_id: p.user_id,
        profile_id: p.profile_id,
        video_id: videoId,
        progress_seconds: progressSec,
        duration_seconds: duration,
        progress_percentage: progressPct,
        completed: progressPct >= 90,
        last_watched_at: new Date().toISOString()
      }, { onConflict: 'user_id,profile_id,video_id' })

    if (error) {
      console.error(`Watch progress error for ${p.distinct_id}:`, error.message)
    }
  } catch (error) {
    console.error(`Failed watch progress for ${p.distinct_id}:`, error.message)
  }
}

async function simulateSupportTicket(p) {
  if (!USE_DATABASE || !p.user_id) return

  try {
    const categories = ['playback_issues', 'account_billing', 'content_request', 'technical_support', 'other']
    const descriptions = [
      'Video playback keeps buffering on my connection',
      'Need help updating my payment method',
      'Would love to see more sci-fi content',
      'App crashes when I try to watch on mobile',
      'Question about my subscription renewal date'
    ]

    const { error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: p.user_id,
        issue_category: randomElement(categories),
        description: randomElement(descriptions),
        status: 'open'
      })

    if (error && !error.message.includes('rate limit')) {
      console.error(`Support ticket error for ${p.distinct_id}:`, error.message)
    }
  } catch (error) {
    console.error(`Failed support ticket for ${p.distinct_id}:`, error.message)
  }
}

async function getProfileId(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    return error ? null : data?.id
  } catch (error) {
    return null
  }
}

// ------------------ MAIN EXECUTION ------------------

async function emitActiveDay(p) {
  // PostHog events
  await posthog.capture({
    distinctId: p.distinct_id,
    event: 'section_clicked',
    properties: { ...eventPropsBase(p), section: 'Popular' },
  })

  // Select random videos for this session
  const sessionVideos = [
    randomElement(VIDEO_IDS),
    randomElement(VIDEO_IDS),
    VIDEO_ID // Always include demo video
  ]

  for (const videoId of sessionVideos) {
    if (rand() < P_OPEN_TITLE) {
      await posthog.capture({
        distinctId: p.distinct_id,
        event: 'title_opened',
        properties: { ...eventPropsBase(p), title_id: videoId },
      })

      if (rand() < P_START_VIDEO) {
        await posthog.capture({
          distinctId: p.distinct_id,
          event: 'video_started',
          properties: { ...eventPropsBase(p), video_id: videoId },
        })

        // Phase 2: Database behaviors
        if (USE_DATABASE && p.db_initialized) {
          // Ensure profile_id is set
          if (!p.profile_id) {
            p.profile_id = await getProfileId(p.user_id)
          }

          if (p.profile_id) {
            // Watch progress for all started videos
            await simulateWatchProgress(p, videoId)

            // Some users rate videos
            if (rand() < P_RATE_VIDEO) {
              await simulateVideoRating(p, videoId)
            }

            // Some users add to watchlist
            if (rand() < P_ADD_WATCHLIST) {
              await simulateWatchlistAddition(p, videoId)
            }
          }
        }

        if (rand() < P_REACH_50) {
          await posthog.capture({
            distinctId: p.distinct_id,
            event: 'video_progress',
            properties: { ...eventPropsBase(p), video_id: videoId, milestone: 50 },
          })
        }
      }
    }
  }

  // Support tickets (low probability)
  if (USE_DATABASE && p.db_initialized && rand() < P_SUPPORT_TICKET) {
    await simulateSupportTicket(p)
  }

  // Rare: plan conversion
  if (rand() < P_PLAN_SELECTED) {
    await posthog.capture({
      distinctId: p.distinct_id,
      event: 'plan_selected',
      properties: { ...eventPropsBase(p), selected_plan: p[PLAN_PROP] },
    })
  }
}

async function main() {
  console.log('🚀 Starting synthetic traffic generation...')
  console.log(`📊 Database mode: ${USE_DATABASE ? 'ENABLED' : 'DISABLED (set SUPABASE_SERVICE_ROLE_KEY to enable)'}`)

  const personas = loadPersonas()
  console.log(`👥 Loaded ${personas.length} personas`)

  // Phase 1: Initialize database users (one-time setup, throttled)
  if (USE_DATABASE) {
    const needsInit = personas.filter(p => !p.db_initialized)
    if (needsInit.length > 0) {
      console.log(`🔧 Initializing ${needsInit.length} personas in database...`)
      // Initialize in batches to avoid rate limits
      const batchSize = 5
      for (let i = 0; i < needsInit.length; i += batchSize) {
        const batch = needsInit.slice(i, i + batchSize)
        await Promise.all(batch.map(p => initializePersonaInDatabase(p)))
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1s delay between batches
      }
      savePersonas(personas)
    }
  }

  // PostHog identification
  await Promise.all(personas.map(identifyIfNeeded))

  // Phase 2: Simulate active users
  const factor = dowFactor()
  let activeCount = 0

  for (const p of personas) {
    const activeToday = rand() < Math.min(Math.max(p.return_prob * factor, 0.02), 0.95)
    if (!activeToday) continue

    activeCount++
    await emitActiveDay(p)
  }

  await posthog.flush()
  await posthog.shutdown()
  savePersonas(personas)

  console.log(`✅ Synthetic traffic complete!`)
  console.log(`   - Active users today: ${activeCount}/${personas.length}`)
  console.log(`   - Database mode: ${USE_DATABASE ? 'ENABLED' : 'DISABLED'}`)
}

main().catch(async (e) => {
  console.error('❌ Error:', e)
  try { await posthog.shutdown() } catch {}
  process.exit(1)
})
