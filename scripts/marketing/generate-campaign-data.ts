/**
 * Marketing Campaign Data Generator
 * Generates 90 days of realistic campaign cost data for PostHog Marketing Analytics
 * Uses dynamic dates (always relative to today) for future-proofing
 */

import { subDays, format, isWeekend, getDate } from 'date-fns';

interface CampaignData {
  date: string;
  campaign: string;
  source: string;
  cost: number;
  clicks: number;
  impressions: number;
  currency: string;
}

export interface CustomerProfile {
  email: string;
  customer_health_score: number;
  lifetime_value: number;
  is_vip: boolean;
  power_user_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  videos_watched_external: number;
  subscription_months: number;
  last_updated: string;
}

// Campaign configurations with budget tiers
const CAMPAIGNS = [
  { name: 'holiday_promo', baseDaily: 150, sources: ['google_ads', 'facebook', 'youtube'] },
  { name: 'seasonal_sale', baseDaily: 100, sources: ['google_ads', 'facebook'] },
  { name: 'influencer_collab', baseDaily: 75, sources: ['youtube', 'twitter'] },
  { name: 'newsletter_weekly', baseDaily: 25, sources: ['newsletter'] },
  { name: 'reddit_launch', baseDaily: 50, sources: ['reddit'] },
  { name: 'retargeting_cart', baseDaily: 80, sources: ['google_ads', 'facebook'] },
];

// Source-specific multipliers for realistic distribution
const SOURCE_MULTIPLIERS: Record<string, { costMult: number; ctrBase: number }> = {
  google_ads: { costMult: 1.0, ctrBase: 0.025 },
  facebook: { costMult: 0.85, ctrBase: 0.018 },
  youtube: { costMult: 1.2, ctrBase: 0.012 },
  newsletter: { costMult: 0.3, ctrBase: 0.045 },
  reddit: { costMult: 0.6, ctrBase: 0.022 },
  twitter: { costMult: 0.7, ctrBase: 0.015 },
};

// Add realistic variance
function addVariance(value: number, variancePercent: number = 0.2): number {
  const variance = value * variancePercent * (Math.random() * 2 - 1);
  return Math.max(0, value + variance);
}

// Get day-of-week multiplier (weekends are lower)
function getDayMultiplier(date: Date): number {
  if (isWeekend(date)) {
    return 0.65 + Math.random() * 0.15; // 65-80% of weekday spend
  }
  return 0.9 + Math.random() * 0.2; // 90-110% variance on weekdays
}

// Get month-end push multiplier (budget flush at end of month)
function getMonthEndMultiplier(date: Date): number {
  const dayOfMonth = getDate(date);
  if (dayOfMonth >= 25) {
    return 1.15 + Math.random() * 0.15; // 15-30% increase at month end
  }
  return 1.0;
}

// Generate campaign data for a specific date
function generateDayData(date: Date): CampaignData[] {
  const dayData: CampaignData[] = [];
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayMult = getDayMultiplier(date);
  const monthEndMult = getMonthEndMultiplier(date);

  for (const campaign of CAMPAIGNS) {
    // Some campaigns don't run every day (simulate real behavior)
    if (campaign.name === 'newsletter_weekly' && date.getDay() !== 2) {
      continue; // Newsletter only on Tuesdays
    }

    for (const source of campaign.sources) {
      const sourceConfig = SOURCE_MULTIPLIERS[source];
      
      // Calculate cost with all multipliers
      const baseCost = campaign.baseDaily * sourceConfig.costMult;
      const cost = addVariance(baseCost * dayMult * monthEndMult, 0.25);
      
      // Calculate impressions based on cost (rough CPM of $5-15)
      const cpm = 5 + Math.random() * 10;
      const impressions = Math.round((cost / cpm) * 1000);
      
      // Calculate clicks based on CTR
      const ctr = addVariance(sourceConfig.ctrBase, 0.3);
      const clicks = Math.round(impressions * ctr);

      dayData.push({
        date: dateStr,
        campaign: campaign.name,
        source,
        cost: Math.round(cost * 100) / 100,
        clicks,
        impressions,
        currency: 'USD',
      });
    }
  }

  return dayData;
}

// Main generator function for campaign data
export function generateCampaignData(days: number = 90): CampaignData[] {
  const allData: CampaignData[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dayData = generateDayData(date);
    allData.push(...dayData);
  }

  return allData;
}

// Demo user emails that should always be VIP power users
const DEMO_USERS: CustomerProfile[] = [
  {
    email: 'leo@posthog.com',
    customer_health_score: 35, // At risk (below 50)
    lifetime_value: 2450,
    is_vip: true,
    power_user_tier: 'gold',
    videos_watched_external: 156,
    subscription_months: 18,
    last_updated: format(new Date(), 'yyyy-MM-dd'),
  },
  {
    email: 'leonhardprinz@gmail.com',
    customer_health_score: 42, // At risk (below 50)
    lifetime_value: 3200,
    is_vip: true,
    power_user_tier: 'platinum',
    videos_watched_external: 203,
    subscription_months: 24,
    last_updated: format(new Date(), 'yyyy-MM-dd'),
  },
];

// Random first names and domains for fake profiles
const FIRST_NAMES = ['james', 'emma', 'michael', 'olivia', 'william', 'sophia', 'david', 'ava', 'john', 'mia', 'chris', 'luna', 'daniel', 'harper', 'matthew', 'ella', 'andrew', 'aria', 'joshua', 'chloe'];
const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'protonmail.com', 'icloud.com'];

// Generate random customer profiles
function generateRandomProfile(index: number): CustomerProfile {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const email = `${firstName}${Math.floor(Math.random() * 1000)}@${domain}`;
  
  // 10% chance of being at-risk (health score < 50)
  const isAtRisk = Math.random() < 0.1;
  const healthScore = isAtRisk 
    ? Math.floor(Math.random() * 40) + 10 // 10-49
    : Math.floor(Math.random() * 50) + 50; // 50-99
  
  const lifetimeValue = Math.floor(Math.random() * 800) + 50; // $50-$850
  const isVip = lifetimeValue > 600; // Top spenders are VIP
  
  // Tier distribution: 40% bronze, 30% silver, 20% gold, 10% platinum
  const tierRoll = Math.random();
  let tier: CustomerProfile['power_user_tier'];
  let videosWatched: number;
  
  if (tierRoll < 0.4) {
    tier = 'bronze';
    videosWatched = Math.floor(Math.random() * 30); // 0-29
  } else if (tierRoll < 0.7) {
    tier = 'silver';
    videosWatched = Math.floor(Math.random() * 40) + 30; // 30-69
  } else if (tierRoll < 0.9) {
    tier = 'gold';
    videosWatched = Math.floor(Math.random() * 50) + 70; // 70-119
  } else {
    tier = 'platinum';
    videosWatched = Math.floor(Math.random() * 100) + 120; // 120-219
  }
  
  return {
    email,
    customer_health_score: healthScore,
    lifetime_value: lifetimeValue,
    is_vip: isVip,
    power_user_tier: tier,
    videos_watched_external: videosWatched,
    subscription_months: Math.floor(Math.random() * 36) + 1, // 1-36 months
    last_updated: format(new Date(), 'yyyy-MM-dd'),
  };
}

// Generate customer profiles including demo users
export function generateCustomerProfiles(randomCount: number = 50): CustomerProfile[] {
  const profiles: CustomerProfile[] = [...DEMO_USERS];
  
  for (let i = 0; i < randomCount; i++) {
    profiles.push(generateRandomProfile(i));
  }
  
  return profiles;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const data = generateCampaignData(90);
  
  // Write to stdout for piping or save to file
  console.log(JSON.stringify(data, null, 2));
  
  // Summary stats
  console.error('\n--- Generation Summary ---');
  console.error(`Total records: ${data.length}`);
  console.error(`Date range: ${data[0]?.date} to ${data[data.length - 1]?.date}`);
  console.error(`Total cost: $${data.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}`);
  console.error(`Total clicks: ${data.reduce((sum, d) => sum + d.clicks, 0).toLocaleString()}`);
  console.error(`Total impressions: ${data.reduce((sum, d) => sum + d.impressions, 0).toLocaleString()}`);
}
