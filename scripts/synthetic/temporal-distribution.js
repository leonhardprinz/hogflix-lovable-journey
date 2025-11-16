// ============= TEMPORAL DISTRIBUTION SYSTEM =============
// Spreads synthetic events throughout the day for realistic retention curves

const rand = () => Math.random()
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min

/**
 * Generate realistic session start time for a user
 * @param {Object} persona - User persona with preferred_session_times
 * @param {number} sessionIndex - Which session number this is (0, 1, 2...)
 * @returns {Date} Session start timestamp
 */
export function generateSessionTimestamp(persona, sessionIndex = 0) {
  const now = new Date()
  const todayStart = new Date(now.setHours(0, 0, 0, 0))
  
  // Pick a preferred session time for this user (rotate through their preferences)
  const preferredHour = persona.preferred_session_times[
    sessionIndex % persona.preferred_session_times.length
  ]
  
  // Add randomness: ±30 minutes from preferred time
  const minuteOffset = randInt(-30, 30)
  
  // Calculate timestamp
  const timestamp = new Date(todayStart)
  timestamp.setHours(
    preferredHour, 
    minuteOffset, 
    randInt(0, 59), 
    randInt(0, 999)
  )
  
  // Apply timezone offset (hours)
  if (persona.timezone_offset) {
    timestamp.setHours(timestamp.getHours() + persona.timezone_offset)
  }
  
  return timestamp
}

/**
 * Generate event timestamp within a session
 * Events are spread throughout the session duration
 * @param {Date} sessionStart - When the session started
 * @param {number} eventIndex - Which event in the session (0, 1, 2...)
 * @param {number} totalEvents - Total events expected in this session
 * @param {number} sessionDurationMinutes - How long the session lasts
 * @returns {Date} Event timestamp
 */
export function generateEventTimestamp(
  sessionStart, 
  eventIndex, 
  totalEvents, 
  sessionDurationMinutes = 30
) {
  const sessionDuration = sessionDurationMinutes * 60 * 1000 // to milliseconds
  
  // Spread events evenly, with some randomness
  const eventSpacing = sessionDuration / Math.max(totalEvents, 1)
  const baseOffset = eventIndex * eventSpacing
  const randomVariance = rand() * eventSpacing * 0.3 // ±30% variance
  
  const offset = baseOffset + randomVariance
  
  return new Date(sessionStart.getTime() + offset)
}

/**
 * Generate temporal properties for a new persona
 * Creates realistic time-of-day preferences and session patterns
 * @returns {Object} Temporal properties to merge into persona
 */
export function generateTemporalProperties() {
  // Common timezone offsets (relative to UTC)
  const timezones = [-8, -5, 0, 1, 8] // PST, EST, UTC, CET, Asia
  
  // Generate 1-3 preferred session times (in UTC hours)
  const sessionCount = randInt(1, 3)
  const possibleTimes = {
    morning: randInt(7, 11),   // 7-11 AM
    lunch: randInt(12, 14),    // 12-2 PM
    evening: randInt(18, 22),  // 6-10 PM
    night: randInt(22, 24)     // 10 PM - midnight
  }
  
  const timeSlots = Object.values(possibleTimes)
  const shuffled = timeSlots.sort(() => rand() - 0.5)
  const selectedTimes = shuffled.slice(0, sessionCount).sort((a, b) => a - b)
  
  return {
    // When user prefers to be active (UTC hours)
    preferred_session_times: selectedTimes,
    
    // How long sessions typically last (minutes)
    session_duration_avg: randInt(15, 45),
    
    // User's timezone offset from UTC
    timezone_offset: timezones[randInt(0, timezones.length - 1)]
  }
}

/**
 * Create a timestamped PostHog event
 * @param {Object} posthog - PostHog client instance
 * @param {string} distinctId - User distinct ID
 * @param {string} event - Event name
 * @param {Object} properties - Event properties
 * @param {Date} timestamp - When the event occurred
 */
export async function captureWithTimestamp(posthog, distinctId, event, properties, timestamp) {
  await posthog.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      // Add debug info in properties for verification
      synthetic_timestamp: timestamp.toISOString(),
      synthetic_hour_utc: timestamp.getUTCHours()
    },
    timestamp: timestamp
  })
}
