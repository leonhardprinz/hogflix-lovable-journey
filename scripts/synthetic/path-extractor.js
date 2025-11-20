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
  
  // Determine viewing pattern based on engagement score and randomness
  let pattern
  if (random < 0.45) {
    pattern = 1 // Full completion (45%)
  } else if (random < 0.70) {
    pattern = 2 // Mid drop-off (25%)
  } else if (random < 0.87) {
    pattern = 3 // Early drop-off (17%)
  } else {
    pattern = 4 // Immediate bounce (13%)
  }
  
  // Adjust pattern based on engagement score
  if (persona.engagement_score >= 8 && pattern === 4) pattern = 1 // High engagement rarely bounces
  if (persona.engagement_score >= 7 && pattern >= 3) pattern = 2 // Good engagement gets to 50%
  if (persona.engagement_score <= 3 && pattern === 1) pattern = 3 // Low engagement rarely completes
  
  // Add timing variation (some users pause, others skip)
  const timingVariation = 0.7 + Math.random() * 0.6 // 0.7x to 1.3x speed
  
  let cumulativeDelay = 0
  
  // video:started
  events.push({
    event: 'video:started',
    properties: enrichEventProperties(videoUrl, {
      ...baseProperties,
      video_id: videoId,
    }),
    delay: 0
  })
  
  // Milestone 25%
  if (pattern >= 3) {
    cumulativeDelay += Math.floor((30 + Math.random() * 90) * timingVariation) // 30-120s
    events.push({
      event: 'video:progress_milestone',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        milestone: 25,
        progress_percentage: 25
      }),
      delay: cumulativeDelay
    })
  }
  
  // Milestone 50%
  if (pattern >= 2) {
    cumulativeDelay += Math.floor((45 + Math.random() * 105) * timingVariation) // 45-150s
    events.push({
      event: 'video:progress_milestone',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        milestone: 50,
        progress_percentage: 50
      }),
      delay: cumulativeDelay
    })
  }
  
  // Milestone 75%
  if (pattern >= 1) {
    cumulativeDelay += Math.floor((40 + Math.random() * 90) * timingVariation) // 40-130s
    events.push({
      event: 'video:progress_milestone',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        milestone: 75,
        progress_percentage: 75
      }),
      delay: cumulativeDelay
    })
    
    // video:completed
    cumulativeDelay += Math.floor((30 + Math.random() * 70) * timingVariation) // 30-100s
    const completionPct = 95 + Math.random() * 5 // 95-100%
    events.push({
      event: 'video:completed',
      properties: enrichEventProperties(videoUrl, {
        ...baseProperties,
        video_id: videoId,
        completion_pct: Math.round(completionPct)
      }),
      delay: cumulativeDelay
    })
  }
  
  return { events, pattern, finalProgress: pattern === 1 ? 100 : pattern === 2 ? 50 : pattern === 3 ? 25 : 5 }
}
