# HogFlix Supabase Migration Scripts

Migration from OLD Supabase (`kawxtrzyllgzmmwfddil`) → NEW Supabase (`ygbftctnpvxhflpamjrt`).

## Prerequisites

You'll need **service role keys** for both Supabase projects. Get them from:
- **Old:** https://supabase.com/dashboard/project/kawxtrzyllgzmmwfddil/settings/api
- **New:** https://supabase.com/dashboard/project/ygbftctnpvxhflpamjrt/settings/api

## Step-by-Step

### Step 1: Apply Schema
Copy the contents of `01_schema.sql` and run it in the **new** Supabase SQL Editor:
https://supabase.com/dashboard/project/ygbftctnpvxhflpamjrt/sql

### Step 2: Migrate Storage Files
```bash
npm install @supabase/supabase-js

SUPABASE_OLD_URL=https://kawxtrzyllgzmmwfddil.supabase.co \
SUPABASE_OLD_KEY=<old-service-role-key> \
SUPABASE_NEW_URL=https://ygbftctnpvxhflpamjrt.supabase.co \
SUPABASE_NEW_KEY=<new-service-role-key> \
node scripts/migration/02_migrate_storage.js
```

### Step 3: Seed Subscription Plans
Copy `03_seed_data.sql` and run in the **new** SQL Editor.

### Step 4: Export & Import Video Data
```bash
SUPABASE_OLD_URL=https://kawxtrzyllgzmmwfddil.supabase.co \
SUPABASE_OLD_KEY=<old-service-role-key> \
node scripts/migration/04_export_video_data.js > scripts/migration/05_video_data.sql
```
Then copy `05_video_data.sql` and run in the **new** SQL Editor.

### Step 5: Deploy Edge Functions
```bash
npx supabase link --project-ref ygbftctnpvxhflpamjrt
npx supabase functions deploy --no-verify-jwt
npx supabase secrets set \
  SUPABASE_URL=https://ygbftctnpvxhflpamjrt.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<new-service-role-key> \
  POSTHOG_KEY=phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh \
  POSTHOG_HOST=https://eu.i.posthog.com \
  POSTHOG_PROJECT_ID=85924
```

### Step 6: Update Vercel
In https://vercel.com — update environment variables:
- `VITE_SUPABASE_URL` → `https://ygbftctnpvxhflpamjrt.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` → anon key from new project

### Step 7: Verify
1. Visit the Vercel deployment URL
2. Check that videos load and play
3. Test sign up/login flow
4. Test watchlist, ratings, support tickets
