// One-off script: create the 7 hardcoded synthetic users in Supabase
// Run: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-synthetic-users.js

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygbftctnpvxhflpamjrt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required')
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-synthetic-users.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const USERS = [
  { email: 'summers.nor-7f@icloud.com',      password: 'zug2vec5ZBE.dkq*ubk' },
  { email: 'slatted_combats.9i@icloud.com',  password: 'qmt8fhv2vju1DMC*bzn' },
  { email: 'treadle-tidbit-1b@icloud.com',   password: 'avf6zqh6tfn!rap.MED' },
  { email: 'toppers.tester_3c@icloud.com',   password: 'sVcj_Z4HF4@sH24*xg36' },
  { email: 'slate-polders3m@icloud.com',     password: 'wbt_-bwbkUe@y9J_J.sK' },
  { email: 'cabals-foyer-5w@icloud.com',     password: '3f_ApN4jt4QQr@mYKg3Y' },
  { email: 'arroyo.gunner_6z@icloud.com',    password: 'eavAX!qGPmHyP*J9TwKY' },
]

;(async () => {
  console.log(`\nCreating ${USERS.length} synthetic users in Supabase (${SUPABASE_URL})\n`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,   // skip email verification
      user_metadata: { is_synthetic: true }
    })

    if (error) {
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        console.log(`  ⏭  ${user.email} — already exists, skipping`)
        skipped++
      } else {
        console.error(`  ✗  ${user.email} — ${error.message}`)
        failed++
      }
    } else {
      console.log(`  ✓  ${user.email} — created (id: ${data.user.id})`)
      created++
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped (already exist), ${failed} failed`)
})()
