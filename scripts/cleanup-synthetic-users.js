// Cleanup synthetic Supabase accounts older than RETENTION_DAYS
// Deletes users created by playwright-journey-new-user.js and pricing-experiment-funnel.js
// Safe: only targets accounts with is_synthetic=true in user_metadata, older than cutoff
//
// Run: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/cleanup-synthetic-users.js
// CI:  called automatically by synthetic.yml after each run

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygbftctnpvxhflpamjrt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RETENTION_DAYS = parseInt(process.env.SYNTHETIC_USER_RETENTION_DAYS || '14', 10)
const DRY_RUN = process.env.DRY_RUN === 'true'

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// The 7 permanent hardcoded users — never delete these
const PERMANENT_USERS = new Set([
  'summers.nor-7f@icloud.com',
  'slatted_combats.9i@icloud.com',
  'treadle-tidbit-1b@icloud.com',
  'toppers.tester_3c@icloud.com',
  'slate-polders3m@icloud.com',
  'cabals-foyer-5w@icloud.com',
  'arroyo.gunner_6z@icloud.com',
])

;(async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  console.log(`\nCleaning up synthetic Supabase users`)
  console.log(`  Retention: ${RETENTION_DAYS} days (cutoff: ${cutoff})`)
  console.log(`  Dry run: ${DRY_RUN}\n`)

  let page = 1
  const perPage = 100
  let totalDeleted = 0
  let totalSkipped = 0

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error(`Error listing users: ${error.message}`)
      break
    }

    const users = data?.users ?? []
    if (users.length === 0) break

    for (const user of users) {
      const isSynthetic = user.user_metadata?.is_synthetic === true
      const isPermanent = PERMANENT_USERS.has(user.email)
      const isOld = user.created_at < cutoff

      if (!isSynthetic || isPermanent || !isOld) {
        totalSkipped++
        continue
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete: ${user.email} (created: ${user.created_at})`)
        totalDeleted++
        continue
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error(`  ✗ Failed to delete ${user.email}: ${deleteError.message}`)
      } else {
        console.log(`  ✓ Deleted: ${user.email} (created: ${user.created_at})`)
        totalDeleted++
      }
    }

    if (users.length < perPage) break
    page++
  }

  console.log(`\nDone: ${totalDeleted} ${DRY_RUN ? '(would be) ' : ''}deleted, ${totalSkipped} kept`)
})()
