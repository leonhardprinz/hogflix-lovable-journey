# Synthetic Traffic System Documentation

## Overview

HogFlix uses a comprehensive synthetic traffic generation system to create realistic demo data for analytics, testing, and showcasing platform capabilities. The system operates in two modes:

1. **PostHog Events Only** - Lightweight event tracking without database persistence
2. **Full Database Mode** - Creates real users, subscriptions, and interactions in Supabase

## Architecture

### Two-Tier Approach

#### Tier 1: Server-Side Event Generation (`scripts/synthetic-traffic.js`)
- Generates PostHog analytics events via Node.js
- Optionally creates database records in Supabase
- Maintains persona state across runs
- Scheduled to run every 30 minutes + daily via GitHub Actions

#### Tier 2: Browser-Based Sessions (`scripts/playwright-bot.js`)
- Simulates real browser sessions using Playwright
- Generates authentic pageview and interaction events
- Creates realistic session flows and user journeys

### Persona System

**Personas** are synthetic users with consistent behavior patterns:
- 400 personas by default (configurable via `PERSONA_POOL`)
- Each persona has:
  - Unique identifier (`p_00000` - `p_00399`)
  - Subscription plan (Basic, Standard, Premium)
  - Acquisition source (direct, newsletter, LinkedIn, etc.)
  - Return probability (likelihood to be active each day)
  - Database backing (optional user account + profile)

**State Persistence:**
- Stored in `.synthetic_state/personas.json`
- Preserved across GitHub Actions runs via cache
- Contains both PostHog IDs and Supabase user IDs

## Database Mode Features

### Phase 1: User Initialization

Creates real Supabase users with:
- Email: `p_XXXXX@hogflix-synthetic.test`
- Auto-confirmed (no email verification needed)
- User metadata tagged with `is_synthetic: true`
- Matching profiles in `profiles` table
- Active subscriptions in `user_subscriptions` table
- Historical start dates (randomized over last 90 days)
- 10% churn rate (expired subscriptions)

### Phase 2: Realistic Behavior

Simulates authentic user interactions:

| Behavior | Probability | Database Table | Notes |
|----------|-------------|----------------|-------|
| Watch progress | 100% of video starts | `watch_progress` | Realistic completion rates |
| Video ratings | 20% of viewers | `video_ratings` | Plan-based rating distribution |
| Watchlist additions | 30% of active users | `user_watchlist` | Random video selections |
| Support tickets | 2% per session | `support_tickets` | Respects rate limiting (5/hour) |

**Rating Distribution:**
- Basic plan: avg 3.2 stars
- Standard plan: avg 3.8 stars  
- Premium plan: avg 4.2 stars
- Normal distribution with variance

## Usage

### Running Locally

**PostHog Events Only:**
```bash
PH_PROJECT_API_KEY=your_key node scripts/synthetic-traffic.js
```

**Full Database Mode:**
```bash
PH_PROJECT_API_KEY=your_key \
SUPABASE_SERVICE_ROLE_KEY=your_service_key \
node scripts/synthetic-traffic.js
```

**Custom Persona Pool:**
```bash
PERSONA_POOL=100 node scripts/synthetic-traffic.js
```

### GitHub Actions

The workflow runs automatically:
- Every 30 minutes: Both server + browser traffic
- Daily at 7:15 UTC: Full regeneration
- Manual trigger: via GitHub Actions UI

**Required Secrets:**
- `PH_PROJECT_API_KEY` - PostHog project API key
- `PH_HOST` - PostHog host (optional, defaults to EU)
- `SUPABASE_SERVICE_ROLE_KEY` - Enables database mode (optional)

## Data Management

### Counting Synthetic Data

As an admin, check synthetic data counts:

```sql
SELECT * FROM count_synthetic_data();
```

Returns:
```json
{
  "profiles": 400,
  "subscriptions": 360,
  "watch_progress": 1523,
  "video_ratings": 305,
  "watchlist": 458,
  "support_tickets": 12
}
```

### Cleanup

**⚠️ Admin Only Operation**

To remove all synthetic data from the database:

```sql
SELECT * FROM cleanup_synthetic_data();
```

This will delete:
- All watch progress records
- All video ratings
- All watchlist entries
- All support tickets
- All user subscriptions
- All profile records

**Note:** Auth users must be deleted separately via Supabase Dashboard:
1. Go to Authentication → Users
2. Filter by email: `@hogflix-synthetic.test`
3. Bulk delete users

### Full Reset

To completely reset the synthetic system:

1. **Clean database:**
   ```sql
   SELECT * FROM cleanup_synthetic_data();
   ```

2. **Delete auth users** via Supabase Dashboard

3. **Clear persona state:**
   ```bash
   rm -rf .synthetic_state
   ```

4. **Re-run script:**
   ```bash
   node scripts/synthetic-traffic.js
   ```

## PostHog Integration

### Event Tagging

All synthetic events include:
```javascript
{
  is_synthetic: true,
  synthetic: true,
  source: 'hogflix-bot',
  $utm_source: '<acquisition_source>',
  $utm_medium: 'synthetic',
  $utm_campaign: 'hogflix-bot'
}
```

### Filtering Synthetic Data

**In PostHog Insights:**
1. Add filter: `is_synthetic = true` to view only synthetic
2. Add filter: `is_synthetic ≠ true` to exclude synthetic

**In Code (main.tsx):**
```typescript
before_send: (event: any) => {
  const isSynthetic = event?.properties?.is_synthetic === true;
  const isDemo = event?.properties?.category === 'PostHog Demo';
  
  if (isSynthetic && isDemo) {
    return null; // Block synthetic demo events
  }
  return event;
}
```

## Event Types Generated

### PostHog Events

| Event | Description | Properties |
|-------|-------------|------------|
| `section_clicked` | User browses categories | `section` |
| `title_opened` | Video detail page viewed | `title_id` |
| `video_started` | Playback initiated | `video_id` |
| `video_progress` | Milestone reached | `video_id`, `milestone` |
| `plan_selected` | Conversion event | `selected_plan` |

### Database Records

| Table | Record Type | Frequency |
|-------|-------------|-----------|
| `profiles` | User profile | One-time per persona |
| `user_subscriptions` | Active subscription | One-time per persona |
| `watch_progress` | Video progress | Per video watched |
| `video_ratings` | Star rating | 20% of videos watched |
| `user_watchlist` | Saved video | 30% of active sessions |
| `support_tickets` | Help request | 2% of active sessions |

## Performance & Limits

### Rate Limiting

**Support Tickets:**
- Max 5 tickets per user per hour (enforced by DB trigger)
- Synthetic traffic respects this limit

**User Creation:**
- Batched in groups of 5
- 1 second delay between batches
- Prevents Supabase API rate limits

### Costs

**PostHog:**
- ~15,000 events/day with 400 personas
- Configure billing alerts in PostHog dashboard

**Supabase:**
- Auth users count toward plan limits
- Database rows count toward storage
- Consider cleanup for long-running demos

**GitHub Actions:**
- ~2,000 minutes/month for current schedule
- Well within free tier limits

## Troubleshooting

### No Database Records Created

**Check:**
1. Is `SUPABASE_SERVICE_ROLE_KEY` set?
2. Run `node scripts/synthetic-traffic.js` and look for "Database mode: ENABLED"
3. Check Supabase logs for errors

### Duplicate Key Errors

**Normal behavior:**
- First run creates users
- Subsequent runs update existing users
- Errors about duplicates can be safely ignored

### Rate Limit Errors

**Support tickets:**
- Expected when testing
- Synthetic traffic respects the 5/hour limit
- Some personas may hit the limit

### Personas Not Active

**Check:**
1. `return_prob` in personas.json (should be 0.2-0.6)
2. Day of week (weekends have higher activity)
3. Look for "Active users today: X/400" in output

## Security & Best Practices

### Production Safety

**DO:**
- ✅ Tag all synthetic data with `is_synthetic: true`
- ✅ Use dedicated email domain (`@hogflix-synthetic.test`)
- ✅ Filter synthetic data in production analytics
- ✅ Document cleanup procedures

**DON'T:**
- ❌ Run synthetic traffic against production without tagging
- ❌ Mix synthetic and real user data
- ❌ Expose synthetic user credentials
- ❌ Leave synthetic data in production long-term

### Data Privacy

- Synthetic users contain NO real PII
- All data is clearly marked as synthetic
- Safe to share in demos and screenshots
- Can be deleted without compliance concerns

## Monitoring

### Key Metrics to Track

1. **Persona initialization rate** - How many personas have database accounts
2. **Active user rate** - Daily active synthetic users
3. **Event generation rate** - PostHog events per hour
4. **Database growth** - Synthetic data storage usage
5. **Error rate** - Failed operations in logs

### Alerts to Set

- PostHog event volume spikes
- Supabase storage approaching limits
- GitHub Actions workflow failures
- Synthetic user count exceeds expected

## Future Enhancements

### Planned Features

- [ ] FlixBuddy chat conversations
- [ ] Subscription upgrades/downgrades
- [ ] Payment failure simulation
- [ ] Geographic diversity (multi-region)
- [ ] Video upload simulation (admin user)
- [ ] A/B test participation

### Configuration Options

Consider adding:
- Persona behavior profiles (binge-watcher, casual viewer, etc.)
- Time-of-day activity patterns
- Device type simulation (mobile, desktop, TV)
- Content preference modeling

## Support

For issues or questions:
1. Check this documentation
2. Review GitHub Actions logs
3. Check Supabase edge function logs
4. Verify PostHog event delivery

## Related Files

- `scripts/synthetic-traffic.js` - Main server-side script
- `scripts/playwright-bot.js` - Browser simulation
- `.github/workflows/synthetic.yml` - Automation schedule
- `src/main.tsx` - PostHog filtering logic
- `src/components/SyntheticMarker.tsx` - Browser session detection
- `src/hooks/useSyntheticCheck.ts` - Client-side synthetic check
