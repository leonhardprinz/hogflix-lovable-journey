// ============= ROUTE DISCOVERY SYSTEM =============
// Discovers all routes in the application automatically

import fs from 'node:fs'
import path from 'node:path'

const APP_TSX = 'src/App.tsx'

/**
 * Extract all routes from App.tsx
 */
export function discoverRoutes() {
  try {
    const appContent = fs.readFileSync(APP_TSX, 'utf8')
    const routes = []

    // Match Route components with their paths
    const routeRegex = /<Route\s+path=["']([^"']+)["'][^>]*element=\{[^}]*<(\w+)/g
    let match

    while ((match = routeRegex.exec(appContent)) !== null) {
      const [, path, component] = match
      
      // Skip dynamic routes with params for now (they need special handling)
      if (path.includes(':')) {
        continue
      }

      routes.push({
        path,
        component,
        requiresAuth: appContent.includes(`<Route path="${path}"`) && appContent.includes('ProtectedRoute'),
      })
    }

    console.log(`✅ Discovered ${routes.length} routes`)
    return routes
  } catch (error) {
    console.error('❌ Error discovering routes:', error.message)
    return []
  }
}

/**
 * Categorize routes by type
 */
export function categorizeRoutes(routes) {
  return {
    public: routes.filter(r => !r.requiresAuth),
    protected: routes.filter(r => r.requiresAuth),
    marketing: routes.filter(r => ['/pricing', '/faq', '/help', '/terms', '/privacy'].includes(r.path)),
    core: routes.filter(r => ['/', '/browse', '/my-list'].includes(r.path)),
    features: routes.filter(r => ['/flixbuddy', '/beta-features', '/submit-content'].includes(r.path)),
    support: routes.filter(r => ['/support', '/help'].includes(r.path)),
  }
}

/**
 * Get route metadata for journey planning
 */
export function getRouteMetadata(path) {
  const metadata = {
    '/': {
      type: 'landing',
      importance: 'high',
      commonGoals: ['discover platform', 'sign up', 'explore features'],
      typicalDuration: 30000, // 30s
    },
    '/browse': {
      type: 'catalog',
      importance: 'high',
      commonGoals: ['find content', 'watch video', 'add to watchlist'],
      typicalDuration: 45000,
    },
    '/pricing': {
      type: 'conversion',
      importance: 'high',
      commonGoals: ['compare plans', 'upgrade', 'checkout'],
      typicalDuration: 60000,
    },
    '/flixbuddy': {
      type: 'feature',
      importance: 'medium',
      commonGoals: ['get recommendations', 'ask questions'],
      typicalDuration: 120000, // 2min
    },
    '/my-list': {
      type: 'collection',
      importance: 'medium',
      commonGoals: ['review saved content', 'start watching'],
      typicalDuration: 20000,
    },
    '/support': {
      type: 'help',
      importance: 'low',
      commonGoals: ['find answers', 'submit ticket'],
      typicalDuration: 40000,
    },
    '/submit-content': {
      type: 'contribution',
      importance: 'low',
      commonGoals: ['upload content', 'manage submissions'],
      typicalDuration: 180000, // 3min
    },
    '/admin': {
      type: 'management',
      importance: 'low',
      commonGoals: ['manage content', 'view analytics'],
      typicalDuration: 300000, // 5min
    },
    '/beta-features': {
      type: 'feature',
      importance: 'low',
      commonGoals: ['try new features', 'provide feedback'],
      typicalDuration: 45000,
    },
    '/faq': {
      type: 'info',
      importance: 'low',
      commonGoals: ['find answers', 'learn about platform'],
      typicalDuration: 30000,
    },
    '/help': {
      type: 'info',
      importance: 'low',
      commonGoals: ['find help', 'contact support'],
      typicalDuration: 25000,
    },
  }

  return metadata[path] || {
    type: 'other',
    importance: 'low',
    commonGoals: ['explore'],
    typicalDuration: 15000,
  }
}

/**
 * Get weighted navigation suggestions based on current page
 */
export function getNavigationSuggestions(currentPath, persona) {
  const suggestions = {
    '/': [
      { path: '/browse', weight: 0.4, reason: 'Explore content catalog' },
      { path: '/pricing', weight: 0.2, reason: 'Check subscription plans' },
      { path: '/flixbuddy', weight: 0.1, reason: 'Try AI assistant' },
      { path: '/faq', weight: 0.1, reason: 'Learn more' },
      { path: '/signup', weight: 0.2, reason: 'Create account' },
    ],
    '/browse': [
      { path: '/my-list', weight: 0.3, reason: 'Check saved content' },
      { path: '/flixbuddy', weight: 0.2, reason: 'Get recommendations' },
      { path: '/pricing', weight: 0.1, reason: 'Consider upgrade' },
      { path: '/', weight: 0.1, reason: 'Return home' },
    ],
    '/pricing': [
      { path: '/checkout', weight: 0.4, reason: 'Start subscription' },
      { path: '/faq', weight: 0.2, reason: 'Learn more' },
      { path: '/browse', weight: 0.2, reason: 'See content first' },
      { path: '/', weight: 0.2, reason: 'Return home' },
    ],
    '/flixbuddy': [
      { path: '/browse', weight: 0.5, reason: 'Explore recommendations' },
      { path: '/my-list', weight: 0.2, reason: 'Check watchlist' },
      { path: '/', weight: 0.1, reason: 'Return home' },
    ],
    '/my-list': [
      { path: '/browse', weight: 0.5, reason: 'Find more content' },
      { path: '/flixbuddy', weight: 0.2, reason: 'Get recommendations' },
      { path: '/', weight: 0.1, reason: 'Return home' },
    ],
  }

  const defaults = [
    { path: '/browse', weight: 0.4, reason: 'Explore content' },
    { path: '/', weight: 0.3, reason: 'Return home' },
    { path: '/support', weight: 0.1, reason: 'Get help' },
  ]

  // Adjust weights based on persona
  const baseSuggestions = suggestions[currentPath] || defaults
  return baseSuggestions.map(s => ({
    ...s,
    adjustedWeight: adjustWeightForPersona(s.weight, persona, s.path)
  }))
}

function adjustWeightForPersona(baseWeight, persona, targetPath) {
  let adjusted = baseWeight

  // Activity pattern adjustments
  if (persona.activity_pattern === 'DAILY') {
    // Daily users explore more
    if (['/flixbuddy', '/beta-features', '/submit-content'].includes(targetPath)) {
      adjusted *= 1.5
    }
  } else if (persona.activity_pattern === 'CASUAL') {
    // Casual users focus on core features
    if (['/browse', '/my-list'].includes(targetPath)) {
      adjusted *= 1.3
    }
  }

  // Engagement score adjustments
  if (persona.engagement_score > 80) {
    // High engagement = more exploration
    adjusted *= 1.2
  } else if (persona.engagement_score < 40) {
    // Low engagement = stick to basics
    if (!['/browse', '/', '/pricing'].includes(targetPath)) {
      adjusted *= 0.5
    }
  }

  // Plan-based adjustments
  if (persona.plan === 'Basic' && targetPath === '/pricing') {
    adjusted *= 1.5 // More likely to check upgrade
  }

  return Math.min(adjusted, 1.0) // Cap at 1.0
}
