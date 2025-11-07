// Verify that synthetic events are reaching PostHog
// Uses PostHog Query API to check event counts

const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const POSTHOG_HOST = 'https://eu.i.posthog.com'

if (!POSTHOG_PROJECT_ID) {
  console.error('❌ POSTHOG_PROJECT_ID environment variable not set')
  console.error('   Add your PostHog project ID to GitHub Secrets')
  process.exit(1)
}

if (!POSTHOG_PERSONAL_API_KEY) {
  console.error('❌ POSTHOG_PERSONAL_API_KEY environment variable not set')
  process.exit(1)
}

async function queryPostHog(query) {
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`PostHog API error: ${response.status} ${text}`)
  }

  return await response.json()
}

async function verifyEvents() {
  console.log('🔍 Verifying synthetic events in PostHog...\n')

  // Query for synthetic events in the last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  
  const events = [
    'signup:completed',
    'pricing:page_viewed',
    'pricing:plan_selected',
    'checkout:started',
    'checkout:completed',
    'video:started',
    'video:progress',
    'video:completed',
    'section:clicked',
    'section:viewed',
    'video:title_opened',
    'demo_video:opened',
    'demo_video:completed',
    'flixbuddy:opened',
    'flixbuddy:message_sent'
  ]

  const results = []

  for (const event of events) {
    try {
      const result = await queryPostHog({
        kind: 'EventsQuery',
        select: ['*'],
        where: [
          `event = '${event}'`,
          `properties.is_synthetic = true`,
          `timestamp >= '${tenMinutesAgo}'`
        ],
        limit: 1000
      })

      const count = result.results?.length || 0
      results.push({ event, count })
      
      if (count > 0) {
        console.log(`✓ ${event}: ${count} events`)
      } else {
        console.log(`⚠ ${event}: 0 events`)
      }
    } catch (error) {
      console.error(`❌ ${event}: Query failed - ${error.message}`)
      results.push({ event, count: 0, error: error.message })
    }
  }

  console.log('\n📊 Summary:')
  const totalEvents = results.reduce((sum, r) => sum + (r.count || 0), 0)
  const missingEvents = results.filter(r => r.count === 0).length
  
  console.log(`Total synthetic events (last 10 min): ${totalEvents}`)
  console.log(`Events with data: ${events.length - missingEvents}/${events.length}`)
  
  if (totalEvents === 0) {
    console.error('\n❌ No synthetic events found! Check:')
    console.error('  1. Are scripts running successfully?')
    console.error('  2. Is before_send filter blocking events?')
    console.error('  3. Are PostHog events being flushed?')
    process.exit(1)
  } else if (totalEvents < 10) {
    console.warn('\n⚠ Low event count detected. Expected at least 10 events.')
    process.exit(1)
  } else {
    console.log('\n✓ Synthetic traffic is working correctly!')
  }
}

verifyEvents().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
