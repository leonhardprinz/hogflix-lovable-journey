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
  const { videoId, category, siteUrl = 'https://hogflix-demo.lovable.app' } = options
  
  const pathMap = {
    homepage: '/',
    browse: '/browse',
    search: '/browse?search=true',
    category: `/browse?category=${category || 'action'}`,
    watchlist: '/my-list',
    flixbuddy: '/flixbuddy',
    pricing: '/pricing',
    profiles: '/profiles',
    video: videoId ? `/video/${videoId}` : '/video/demo',
    demo: '/demo',
    help: '/help',
    support: '/support',
    faq: '/faq'
  }
  
  const path = pathMap[entryPoint] || '/'
  return `${siteUrl}${path}`
}
