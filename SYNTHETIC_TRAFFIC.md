# HogFlix Dynamic Synthetic Traffic System

> **Comprehensive simulation of realistic user lifecycles, engagement patterns, and site-wide interactions**

This document describes the **fully dynamic** synthetic traffic system that simulates ~400 users with realistic lifecycles, irregular return patterns, FlixBuddy interactions, and natural churn/signup dynamics.

## 📋 Table of Contents

- [Quick Overview](#quick-overview)
- [System Architecture](#system-architecture)
- [User Lifecycle System](#user-lifecycle-system)
- [Activity Patterns](#activity-patterns)
- [Life Events](#life-events)
- [FlixBuddy Integration](#flixbuddy-integration)
- [Engagement Simulation](#engagement-simulation)
- [Data Model](#data-model)
- [Usage](#usage)
- [Monitoring & Analytics](#monitoring--analytics)
- [Maintenance & Troubleshooting](#maintenance--troubleshooting)

---

## Quick Overview

### What's Simulated

✅ **User Lifecycles**: NEW → ACTIVE → CASUAL → DORMANT → CHURNED  
✅ **Complete User Journeys**: Signup → Browse → Watch → Engage → Subscribe  
✅ **Activity Patterns**: DAILY, REGULAR, WEEKEND, BINGE, MONTHLY  
✅ **Acquisition Channels**: 7+ sources (organic, social, paid, email, referral)  
✅ **Device Diversity**: Desktop (70%), Mobile (25%), Tablet (5%)  
✅ **Browser Mix**: Chrome, Safari, Firefox, Edge across platforms  
✅ **Dynamic Returns**: Irregular visit patterns based on user type  
✅ **Life Events**: Vacations, sick days, busy periods, hype periods  
✅ **New Signups**: 10-20 new users daily via browser flows  
✅ **Pricing/Checkout**: Simulated Stripe test mode purchases  
✅ **Churn Management**: Natural attrition with database cleanup  
✅ **FlixBuddy Chats**: 10% of active users engage with AI assistant  
✅ **Watch Behavior**: Variable session depths, completion rates  
✅ **Engagement Actions**: Ratings, watchlist, support tickets  
✅ **Streaks & Habits**: Bonus engagement for consistent users  

### Target Scale

- **~400 active users** (fluctuates naturally between 380-420)
- **10-20 new signups per day** (via browser signup flows)
- **80-150 active sessions per day** (varies by day of week)
- **20-40 FlixBuddy interactions per day** (rate limited to 50/run)
- **30-60 pricing page visits per day** (upgrade intent tracking)
- **10-20 checkout attempts per day** (simulated Stripe test mode)

---

## System Architecture

### Three-Tier Approach

**Tier 1: Server-Side** (`scripts/synthetic-traffic.js`)
- User lifecycle management
- Database operations (Supabase)
- PostHog event generation with device/browser properties
- FlixBuddy API calls

**Tier 2: Browser-Based New Users** (`scripts/playwright-journey-new-user.js`)
- Complete signup flows with real form fills
- Pricing page interactions
- Feature flag exposure (A/B tests)
- Simulated Stripe checkout (test mode)
- UTM parameter tracking (acquisition source)
- Device/browser rotation
- Creates 10-20 new users per run

**Tier 3: Browser-Based Returning Users** (`scripts/playwright-journey-returning-user.js`)
- Login flows for existing personas
- Content browsing and watching
- Pricing page revisits (upgrade intent)
- FlixBuddy interactions
- Watchlist/rating actions
- 80-100 sessions per run

### State Persistence

All persona state is stored in `.synthetic_state/`:
- `personas.json` - Complete user state (lifecycles, patterns, metrics, device/browser, UTMs)
- `daily_metrics.json` - Historical analytics (last 90 days)

Both files are cached in GitHub Actions and persist across runs.

---

## User Lifecycle System

### Lifecycle States

```
NEW (0-7 days) → ACTIVE (regular) → DORMANT (14+ days inactive) → CHURNED (30+ days) → DELETED
                      ↑                     ↓
                      └─────────────────────┘
                      (reactivation possible)
```

#### State Definitions

**NEW** (First 7 days)
- High engagement (85-95 score)
- Daily activity pattern initially
- Exploring content library
- 80%+ base return probability

**ACTIVE** (Regular users)
- 50-80 engagement score
- Assigned permanent activity pattern after 14 days
- Most common state (60-70% of users)

**DORMANT** (14+ days inactive)
- 30% return probability modifier
- 3% daily chance to churn
- Reactivation possible

**CHURNED** (Lost users)
- 0% return probability
- 90% cleaned from database after detection
- 10% kept for potential reactivation analytics

### Churn & Replacement

**Daily Process**:
1. Identify DORMANT users inactive 30+ days
2. 3% daily probability → CHURNED
3. Clean 90% of churned users from database
4. Generate 2-5 new signups to replace them
5. Maintain ~400 active user pool

**Cleanup includes**:
- `watch_progress` records
- `video_ratings` records
- `user_watchlist` entries
- `chat_conversations` and `chat_messages`
- `support_tickets`
- `user_subscriptions`
- `profiles` table entry
- Auth user (via Supabase Admin API)

---

## Activity Patterns

### Pattern Types

#### 🔥 DAILY (15% of users)
- **Base Return**: 85%
- **Profile**: Power users, Premium skew
- **Behavior**: High session depth (5-10 videos), 70%+ completion
- **Streaks**: Often build 7+ day streaks

#### 📅 REGULAR (40% of users)
- **Base Return**: 45%
- **Profile**: Most common, Standard/Premium
- **Behavior**: Moderate depth (2-5 videos), 60% completion
- **Peak Days**: Thursday-Saturday boost

#### 🏖️ WEEKEND (20% of users)
- **Base Return**: 15% weekdays, **85% weekends**
- **Profile**: Work-week users, Basic/Standard
- **Behavior**: Binge on Sat/Sun, light weekday

#### 🍿 BINGE (15% of users)
- **Base Return**: 5% normally, **90% during binges**
- **Profile**: All plans, cyclical engagement
- **Behavior**: 
  - Binge periods: 3-7 days, 10-15 videos/session
  - Cooldown: 10-21 days minimal activity
  - Then cycle repeats

#### 📆 MONTHLY (10% of users)
- **Base Return**: 3% daily, **80% on days 1-3 of month**
- **Profile**: Light users, Basic skew
- **Behavior**: Check-in visits, 1-3 videos

### Pattern Assignment

**NEW users** start as DAILY (exploring phase)

**After 14 days**, assigned based on plan:
```
Premium:  DAILY 25% | REGULAR 45% | WEEKEND 15% | BINGE 10% | MONTHLY 5%
Standard: DAILY 15% | REGULAR 40% | WEEKEND 20% | BINGE 15% | MONTHLY 10%
Basic:    DAILY 5%  | REGULAR 30% | WEEKEND 25% | BINGE 20% | MONTHLY 20%
```

---

## Life Events

Random events that temporarily override activity patterns:

### Event Types

**🏖️ VACATION** (0.5% daily chance)
- Duration: 7-14 days
- Return probability: **0%** during event
- Models travel, no internet

**🤒 SICK** (1% daily chance)
- Duration: 3-5 days
- Return probability: **10%** during event
- Low engagement when active

**💼 BUSY_WORK** (2% daily chance)
- Duration: 5-10 days
- Return probability: **20%** during event
- Work crunch periods

**🎉 NEW_RELEASE_HYPE** (1% daily chance)
- Duration: 3-7 days
- Return probability: **95%** during event
- Models excitement for new content

Events clear automatically when duration expires.

---

## Streaks & Habituation

### Streak Bonus
- **+5% return probability per 3-day streak** (max +20%)
- Builds user habits
- Decays if broken

### Break Penalty
- **-10% engagement score** after breaking 7+ day streak
- Resets `consecutive_active_days` to 0
- Models disappointment/disengagement

### Engagement Score Dynamics
- Starts at 85-95 for NEW users
- **+2 per active day** (max 100)
- **-1 per inactive day** (min 0)
- **-10 on streak break**
- Influences return probability: `prob += (score - 50) / 200`

---

## FlixBuddy Integration

### Simulation Details

**Trigger Rate**: 10% of daily active users  
**Rate Limit**: 50 calls per script run  
**Throttle**: 1 request per 5 seconds

### Question Templates
```javascript
[
  "What's a good action movie?",
  "I want something funny to watch",
  "Show me sci-fi movies",
  "Recommend a family-friendly movie",
  "What are the most popular shows?",
  "I'm in the mood for a thriller",
  "Any good documentaries?",
  "What should I watch tonight?"
]
```

### Conversation Flow
1. Create `chat_conversations` record
2. Insert user message
3. Call `flixbuddy-chat` edge function (real API)
4. Store assistant response
5. Track in PostHog as `flixbuddy_interaction` event

### Database Schema
```sql
chat_conversations (user_id, profile_id, title)
chat_messages (conversation_id, role, content)
```

---

## Engagement Simulation

### Session Depth by State

| State      | Videos Watched | Avg Completion |
|------------|----------------|----------------|
| NEW        | 3-8            | 45%            |
| ACTIVE     | 2-5            | 65%            |
| CASUAL     | 1-3            | 50%            |
| BINGE MODE | 5-15           | 85%            |

### Navigation Flows

**Entry Points**:
- Homepage: 40%
- Search: 15%
- Category: 20%
- Watchlist: 15%
- FlixBuddy: 10%

**Common Paths**:
- `homepage → popular → video → watch`
- `search → video → watch → related`
- `flixbuddy → video → watch`
- `watchlist → watch → watch` (sequential)

### Interaction Probabilities

| Action              | Probability | Notes                          |
|---------------------|-------------|--------------------------------|
| Open title          | 75%         | Click on video card            |
| Start video         | 60%         | After opening title            |
| Reach 50% progress  | 55%         | Of started videos              |
| Rate video          | 20%         | Plan-based distribution        |
| Add to watchlist    | 30%         | Per active session             |
| Support ticket      | 2%          | Per active session, rate-limited |
| FlixBuddy chat      | 10%         | Of active users, max 50/day    |

### Rating Distributions

```javascript
Premium:  mean 4.2, std 0.8  // Enthusiasts
Standard: mean 3.8, std 1.0  // Neutral
Basic:    mean 3.2, std 1.2  // More critical
```

---

## Data Model

### Enhanced Persona Schema

```javascript
{
  // Identity
  distinct_id: "p_00123_1730123456789",
  plan: "Premium",
  source: "newsletter",
  email: "p_00123_1730123456789@hogflix-synthetic.test",
  
  // Lifecycle
  state: "ACTIVE",
  state_changed_at: "2025-10-28T10:15:00Z",
  days_since_signup: 45,
  signup_date: "2025-09-13T10:15:00Z",
  first_visit_date: "2025-09-12T18:30:00Z",
  last_active: "2025-10-28T10:15:00Z",
  created_at: "2025-09-13T10:15:00Z",
  
  // Device & Browser
  browser: "Chrome",
  browser_version: "120.0",
  device_type: "Desktop",
  os: "Windows",
  screen_width: 1920,
  screen_height: 1080,
  
  // Acquisition
  utm_source: "google",
  utm_medium: "organic",
  utm_campaign: "hogflix-dynamic",
  
  // Activity pattern
  activity_pattern: "REGULAR",
  consecutive_active_days: 3,
  consecutive_missed_days: 0,
  total_sessions: 67,
  
  // Engagement metrics
  engagement_score: 75,
  videos_watched: 89,
  avg_watch_completion: 68.5,
  ratings_given: 12,
  watchlist_size: 5,
  flixbuddy_conversations: 2,
  
  // Journey tracking
  pricing_visits: 5,
  checkout_attempts: 1,
  checkout_completions: 1,
  
  // Feature flags
  feature_flags: {
    pricing_upgrade_cta_experiment: "value_focused"
  },
  
  // Temporal state
  in_life_event: null,
  life_event_ends_at: null,
  binge_state: {
    is_binging: false,
    binge_day: 0,
    cooldown_until: null
  },
  
  // Churn tracking
  churned_at: null,
  churn_reason: null,
  
  // Database sync
  db_initialized: true,
  user_id: "uuid-from-supabase",
  profile_id: "uuid-from-profiles-table"
}
```

### Daily Metrics Schema

```javascript
{
  date: "2025-10-28T10:15:00Z",
  total_personas: 398,
  active_today: 87,
  new_signups: 3,
  churned_cleaned: 2,
  flixbuddy_calls: 8,
  state_distribution: {
    NEW: 5,
    ACTIVE: 280,
    DORMANT: 110,
    CHURNED: 3
  },
  pattern_distribution: {
    DAILY: 60,
    REGULAR: 160,
    WEEKEND: 80,
    BINGE: 60,
    MONTHLY: 40
  }
}
```

---

## Usage

### Local Development

#### PostHog Events Only
```bash
export PH_PROJECT_API_KEY=your_key
export PH_HOST=https://eu.i.posthog.com
node scripts/synthetic-traffic.js
```

#### Full Database Mode
```bash
export PH_PROJECT_API_KEY=your_key
export SUPABASE_SERVICE_ROLE_KEY=your_service_key
export SUPABASE_URL=https://kawxtrzyllgzmmwfddil.supabase.co
node scripts/synthetic-traffic.js
```

### GitHub Actions (Automated)

Runs automatically via `.github/workflows/synthetic.yml`:
- **Every 30 minutes**: Quick session simulation
- **Daily at 07:15 UTC**: Full lifecycle updates

**Required Secrets**:
- `PH_PROJECT_API_KEY`
- `PH_HOST`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

### Configuration Options

```bash
# Target pool size (default: 400)
export PERSONA_POOL=400

# State directory (default: .synthetic_state)
export STATE_DIR=.synthetic_state
```

---

## Monitoring & Analytics

### PostHog Dashboards

**Filter synthetic traffic**:
```
is_synthetic = true
```

**Segment by lifecycle**:
```
properties.state in ['NEW', 'ACTIVE', 'DORMANT']
```

**Analyze patterns**:
```
properties.activity_pattern in ['DAILY', 'BINGE', 'WEEKEND']
```

**Device & Browser Segmentation**:
```
properties.$device_type in ['Desktop', 'Mobile', 'Tablet']
properties.$browser in ['Chrome', 'Safari', 'Firefox', 'Edge']
properties.$os in ['Windows', 'macOS', 'iOS', 'Android']
```

**Acquisition Channel Analysis**:
```
properties.$initial_utm_source in ['google', 'facebook', 'google_ads', 'newsletter']
properties.$initial_utm_medium in ['organic', 'social', 'cpc', 'email']
```

### Expected Distributions

**Device & Browser**:
- Desktop: ~70% (Chrome 40%, Safari 20%, Firefox 10%)
- Mobile: ~25% (Safari iOS 15%, Chrome Android 10%)
- Tablet: ~5%

**Acquisition Channels**:
- Organic (google): ~30%
- Social (facebook, twitter, reddit): ~30%
- Paid (google_ads, facebook_ads): ~15%
- Email (newsletter): ~15%
- Direct: ~10%

### Key Metrics to Track

#### Daily KPIs
- Active users (80-150 per day)
- New signups (10-20 per day via browser flows)
- Signup conversion rate (70-80% from pricing)
- Pricing page visits (30-60 per day)
- Checkout attempts (10-20 per day)
- Checkout completion rate (60-70%)
- FlixBuddy usage (20-40 interactions per day)
- Support ticket volume (2-5 per day)

#### Lifecycle Health
- State distribution (% in each state: NEW 5%, ACTIVE 60%, CASUAL 20%, DORMANT 10%, CHURNED 5%)
- Average engagement score by state (NEW 90+, ACTIVE 70-80, CASUAL 50-60)
- Churn rate (DORMANT → CHURNED: ~7-10% monthly)
- Reactivation rate (DORMANT → ACTIVE: ~5-8%)

#### Pattern Analysis
- Pattern distribution alignment (DAILY 15%, REGULAR 40%, WEEKEND 20%, BINGE 15%, MONTHLY 10%)
- Binge cycle completion rates (80%+ complete 5-15 videos)
- Weekend user peak activity (15% boost Sat/Sun)
- Monthly spike days (1-3 per month for MONTHLY users)

#### Engagement Quality
- Average watch completion by state (NEW 45%, ACTIVE 65%, BINGE 85%)
- Rating distribution by plan (Premium 4.2, Standard 3.8, Basic 3.2)
- Watchlist growth rate (3-8 items per active user)
- Session depth trends (NEW 3-8, ACTIVE 2-5, BINGE 5-15 videos)

#### Funnel Performance
- **Signup Funnel**: Homepage → Pricing → Signup → Success (70-80% conversion)
- **Upgrade Funnel**: Browse → Pricing → Checkout → Success (60-70% conversion)
- **Engagement Funnel**: Login → Browse → Title → Video → Watch50% (40-50% reach milestone)

#### Feature Flag Experiments
- `pricing_upgrade_cta_experiment`: Should show ~50/50 variant split
- Each variant: 100+ exposures within 7 days
- Conversion rate variance: 5-15% between variants

#### Retention Cohorts
**Week-over-Week**:
- Week 0: 100%
- Week 1: 65-75%
- Week 2: 50-60%
- Month 1: 35-45%
- Month 3: 25-35%

**By Plan (Month 1)**:
- Basic: ~30%
- Standard: ~40%
- Premium: ~50%

### Daily Metrics History

View `.synthetic_state/daily_metrics.json`:
```javascript
// Last 90 days of metrics for cohort analysis
[
  {
    date: "2025-10-28",
    active_today: 124,
    new_signups: 12,
    churned: 5,
    total_personas: 398,
    device_distribution: {
      Desktop: 275,
      Mobile: 100,
      Tablet: 23
    },
    browser_distribution: {
      Chrome: 160,
      Safari: 120,
      Firefox: 70,
      Edge: 48
    },
    acquisition_distribution: {
      google: 120,
      facebook: 60,
      google_ads: 60,
      newsletter: 60,
      twitter: 40,
      reddit: 20,
      direct: 38
    }
  },
  ...
]
```

---

## Maintenance & Troubleshooting

### Database Cleanup

**Automated Cleanup** (built into script):
- Churned users automatically cleaned (90%)
- 10% retained for reactivation analytics
- Cleanup includes all related records

**Manual Cleanup** (if needed):
```sql
-- Count synthetic data
SELECT * FROM count_synthetic_data();

-- Clean all synthetic data
SELECT * FROM cleanup_synthetic_data();
```

**Delete auth users** via Supabase Dashboard:
- Go to Authentication → Users
- Filter: `email LIKE '%@hogflix-synthetic.test'`
- Bulk delete

### State Management

**Reset personas**:
```bash
rm -rf .synthetic_state
node scripts/synthetic-traffic.js  # Regenerates from scratch
```

**Backup state**:
```bash
cp -r .synthetic_state .synthetic_state.backup
```

**Restore state**:
```bash
rm -rf .synthetic_state
cp -r .synthetic_state.backup .synthetic_state
```

### Common Issues

#### No database records created
- ✅ Check `SUPABASE_SERVICE_ROLE_KEY` is set
- ✅ Verify service role key permissions (admin)
- ✅ Check Supabase logs for RLS policy errors

#### Duplicate key errors
- ✅ Normal on first run for existing users
- ✅ Script handles gracefully with upserts
- ✅ Check for conflicting manual user creation

#### Rate limit errors (429)
- ✅ FlixBuddy limited to 50 calls/run
- ✅ Support tickets throttled (5 per user per hour)
- ✅ User creation batched (5 per second)

#### Personas not returning
- ✅ Check lifecycle state (CHURNED won't return)
- ✅ Verify life events (VACATION = 0% return)
- ✅ Review engagement scores (low score = low return)
- ✅ Check binge cooldowns (BINGE users cycle)

---

## Performance & Limits

### Rate Limiting

**Supabase**:
- User creation: 5 per second (batched)
- Support tickets: 5 per user per hour
- No limit on reads/updates

**PostHog**:
- Unlimited events (priced per volume)
- Batch flushed at end of script

**FlixBuddy**:
- 50 calls per script run (hardcoded)
- 1 request per 5 seconds (throttled)
- Real AI API costs apply

### Expected Costs

**Supabase** (Free tier sufficient):
- Auth users: 50,000 limit (400 synthetic = 0.8%)
- Database: <10MB for 400 users
- Edge functions: <100k invocations/month

**PostHog**:
- ~5,000-10,000 events/day
- Free tier: 1M events/month

**Lovable AI (FlixBuddy)**:
- ~240-360 requests/day
- Check Lovable AI pricing for costs

### Storage Growth

**Database tables** (after 30 days):
- `watch_progress`: ~50 rows/user = 20,000 rows
- `video_ratings`: ~10 rows/user = 4,000 rows
- `user_watchlist`: ~5 rows/user = 2,000 rows
- `chat_messages`: ~2 rows/conversation = ~1,600 rows
- Total: <50MB

**State files**:
- `personas.json`: ~500KB (400 users)
- `daily_metrics.json`: ~100KB (90 days)

---

## Security & Best Practices

### Data Isolation

✅ All synthetic emails: `*@hogflix-synthetic.test`  
✅ `is_synthetic: true` in PostHog properties  
✅ `user_metadata.is_synthetic: true` in Supabase auth  
✅ Separate domain prevents email delivery issues

### Analytics Filtering

**PostHog**: Filter `is_synthetic = false` for production insights  
**Supabase**: Filter `email NOT LIKE '%@hogflix-synthetic.test'`

### Environment Safety

⚠️ **NEVER** run against production without synthetic flags  
⚠️ Use separate PostHog project for testing  
⚠️ Verify `SUPABASE_URL` before enabling database mode

### Privacy

✅ No real PII (all synthetic)  
✅ No external API calls except FlixBuddy  
✅ All data contained in your infrastructure

---

## Future Enhancements

### Planned Features
- [ ] Multi-message FlixBuddy conversations
- [ ] Subscription upgrades/downgrades
- [ ] Payment failure simulation
- [ ] Video upload simulation (admin personas)
- [ ] Geographic diversity (region-based patterns)
- [ ] Device type variation (mobile/tablet/desktop)
- [ ] Time-of-day patterns (evening peaks)
- [ ] Content affinity tracking (genre preferences)

### Configuration Expansions
- [ ] Customizable behavior profiles
- [ ] Adjustable churn rates per plan
- [ ] Dynamic pool scaling
- [ ] Seasonal trend simulation

---

## Support

### Related Files
- **Main Script**: `scripts/synthetic-traffic.js`
- **Browser Bot**: `scripts/playwright-bot.js`
- **GitHub Workflow**: `.github/workflows/synthetic.yml`
- **Cleanup Function**: Database migration with `cleanup_synthetic_data()`
- **Client Integration**: `src/components/SyntheticMarker.tsx`, `src/hooks/useSyntheticCheck.ts`

### Getting Help
1. Check script logs for errors
2. Review `.synthetic_state/personas.json`
3. Check `.synthetic_state/daily_metrics.json`
4. Review PostHog events dashboard
5. Check Supabase logs (auth, database, functions)
6. Review GitHub Actions run logs

---

**Last Updated**: 2025-10-29  
**System Version**: 2.0 (Dynamic Lifecycles & Patterns)
