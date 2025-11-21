/**
 * Path Extraction Helper for Server-Side PostHog Events
 * 
 * PostHog's browser SDK automatically captures $pathname, but server-side
 * events need explicit pathname tracking. This helper ensures consistency
 * between browser and server-side event data.
 */

/**
 * Extract pathname from URL for PostHog events
 * @param {string} url - Full URL or pathname
 * @returns {string} - Extracted pathname (e.g., "/browse", "/video/123")
 */
export function extractPathname(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname
  } catch {
    // If URL parsing fails, try to extract pathname manually
    const match = url.match(/https?:\/\/[^\/]+(\/[^?#]*)/)
    if (match) return match[1]
    
    // If it's already just a pathname, return it
    if (url.startsWith('/')) return url.split('?')[0].split('#')[0]
    
    return '/'
  }
}

/**
 * Add PostHog-standard properties to server-side events
 * Ensures consistency with browser SDK by including $pathname and $current_url
 * 
 * @param {string} url - Full URL or pathname
 * @param {object} baseProperties - Additional event properties
 * @returns {object} - Properties enriched with $pathname, $current_url, and is_synthetic
 */
export function enrichEventProperties(url, baseProperties = {}) {
  const pathname = extractPathname(url)
  
  return {
    ...baseProperties,
    $pathname: pathname,
    $current_url: url,
    is_synthetic: true  // Always tag synthetic traffic
  }
}

/**
 * Get a realistic page path for synthetic traffic
 * @param {string} entryPoint - Entry point type (homepage, search, category, etc.)
 * @param {object} options - Additional options like videoId, category
 * @returns {string} - Realistic page path
 */
export function getRealisticPath(entryPoint, options = {}) {
  const siteUrl = options.siteUrl || 'https://hogflix-demo.lovable.app'
  
  switch (entryPoint) {
    case 'home':
    case 'landing':
      return `${siteUrl}/`
    
    case 'browse':
      if (options.search) return `${siteUrl}/browse?search=true`
      if (options.category) return `${siteUrl}/browse?category=${options.category}`
      return `${siteUrl}/browse`
    
    case 'video':
      if (!options.videoId) throw new Error('videoId required for video path')
      return `${siteUrl}/video/${options.videoId}`
    
    case 'my-list':
    case 'watchlist':
      return `${siteUrl}/my-list`
    
    case 'flixbuddy':
      return `${siteUrl}/flixbuddy`
    
    case 'pricing':
      return `${siteUrl}/pricing`
    
    case 'demo':
      return `${siteUrl}/demo`
    
    default:
      return `${siteUrl}/`
  }
}

/**
 * Generate realistic video viewing milestone events
 * Returns array of events to capture with proper timing and drop-off patterns
 * 
 * Patterns:
 * - Pattern 1 (40-50%): Full completion with all milestones
 * - Pattern 2 (20-30%): Mid-video drop-off (stops at 50%)
 * - Pattern 3 (15-20%): Early drop-off (stops at 25%)
 * - Pattern 4 (10-15%): Immediate bounce (just started)
 */
export function generateVideoMilestoneEvents(persona, videoId, videoUrl, baseProperties = {}) {
  const events = []
  const random = Math.random()
  
  // Determine viewing pattern - 6 distinct journey types
  let pattern
  if (random < 0.23) {
    pattern = 1 // Immediate bounce (23%)
  } else if (random < 0.40) {
    pattern = 2 // Early drop-off (17%)
  } else if (random < 0.58) {
    pattern = 3 // Mid-video abandonment (18%)
  } else if (random < 0.65) {
    pattern = 4 // Late drop-off (7%)
  } else if (random < 0.93) {
    pattern = 5 // Full completion (38%)
  } else {
    pattern = 6 // Interrupted viewing (7%)
  }
  
  // Weekend boost - 5% higher completion on weekends
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6
  if (isWeekend && random >= 0.58 && random < 0.63) {
    pattern = 5
  }
  
  // Adjust pattern based on engagement score
  if (persona.engagement_score >= 9 && pattern <= 2) {
    pattern = 5 // Highly engaged users complete videos
  } else if (persona.engagement_score >= 7 && pattern === 1) {
    pattern = 2 // Good engagement reduces immediate bounce
  } else if (persona.engagement_score <= 3 && pattern >= 5) {
    pattern = 3 // Low engagement prevents completion
  } else if (persona.engagement_score <= 2 && pattern >= 3) {
    pattern = 1 // Very low engagement leads to bounce
  }
  
  // Add timing variation (some users pause, others skip)
  const timingVariation = 0.7 + Math.random() * 0.6 // 0.7x to 1.3x speed
  
  let cumulativeDelay = 0
  
  // 1. video:started (ALL patterns)
  events.push({
    event: 'video:started',
    properties: enrichEventProperties(videoUrl, {
      ...baseProperties,
      video_id: videoId,
    }),
    delay: 0
  })
  
  // 2. Milestone 25% (patterns 2-6, NOT pattern 1)
  if (pattern >= 2) {
    cumulativeDelay += Math.floor((30 + Math.random() * 60) * timingVariation) // 30-90s
    events.push({
      event: 'video:progress_milestone',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        milestone: 25, // Numeric value
      }),
      delay: cumulativeDelay
    })
  }
  
  // 3. Milestone 50% (patterns 3-6)
  if (pattern >= 3) {
    cumulativeDelay += Math.floor((40 + Math.random() * 60) * timingVariation) // 40-100s
    events.push({
      event: 'video:progress_milestone',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        milestone: 50,
      }),
      delay: cumulativeDelay
    })
  }
  
  // 4. Milestone 75% (patterns 4-6)
  if (pattern >= 4) {
    cumulativeDelay += Math.floor((40 + Math.random() * 60) * timingVariation) // 40-100s
    events.push({
      event: 'video:progress_milestone',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        milestone: 75,
      }),
      delay: cumulativeDelay
    })
  }
  
  // 5. video:completed (patterns 5-6 ONLY)
  if (pattern >= 5) {
    cumulativeDelay += Math.floor((30 + Math.random() * 50) * timingVariation) // 30-80s
    const completionPct = 95 + Math.floor(Math.random() * 6) // 95-100%
    events.push({
      event: 'video:completed',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        completion_pct: completionPct
      }),
      delay: cumulativeDelay
    })
  }
  
  // 6. Interrupted viewing behavior (pattern 6 only)
  if (pattern === 6) {
    const interruptionType = Math.random() < 0.5 ? 'rageclick' : 'long_pause'
    
    if (interruptionType === 'rageclick') {
      // Add 1-2 rage click events during viewing
      const rageClickCount = Math.random() < 0.7 ? 1 : 2
      for (let i = 0; i < rageClickCount; i++) {
        const rageDelay = Math.floor(cumulativeDelay * (0.3 + Math.random() * 0.5)) // Random point during viewing
        events.splice(2 + i, 0, { // Insert after video:started
          event: '$rageclick',
          properties: enrichEventProperties(videoUrl, {
            ...baseProperties,
            video_id: videoId,
            element_text: 'Play button',
          }),
          delay: rageDelay
        })
      }
    } else {
      // Replace one of the milestone delays with a long pause (200-400s)
      const pauseIndex = 1 + Math.floor(Math.random() * 3) // Pause at 25%, 50%, or 75%
      if (events[pauseIndex]) {
        events[pauseIndex].delay += Math.floor(200 + Math.random() * 200)
      }
    }
  }
  
  // Return with detailed pattern info
  const progressMap = { 1: 5, 2: 25, 3: 50, 4: 75, 5: 100, 6: 100 }
  return { 
    events, 
    pattern, 
    finalProgress: progressMap[pattern],
    interrupted: pattern === 6
  }
}
