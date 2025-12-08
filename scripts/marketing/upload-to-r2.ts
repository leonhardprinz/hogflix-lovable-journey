/**
 * R2 Upload Script
 * Uploads generated marketing campaign data and customer profiles to Cloudflare R2 bucket
 * Uses S3-compatible API via AWS SDK
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateCampaignData, generateCustomerProfiles } from './generate-campaign-data';

// Load credentials from environment
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'hogflix-demo';

// Validate required environment variables
function validateEnv(): void {
  const missing: string[] = [];
  
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!R2_ENDPOINT) missing.push('R2_ENDPOINT');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }
}

// Create S3 client configured for R2
function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

// Upload data to R2
async function uploadToR2(client: S3Client, data: object, key: string): Promise<void> {
  const jsonContent = JSON.stringify(data, null, 2);
  
  console.log(`📤 Uploading to R2: ${R2_BUCKET_NAME}/${key}`);
  console.log(`   Size: ${(jsonContent.length / 1024).toFixed(2)} KB`);
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: jsonContent,
    ContentType: 'application/json',
  });
  
  await client.send(command);
  
  console.log(`✅ ${key} uploaded successfully!`);
}

// Main execution
async function main(): Promise<void> {
  console.log('🚀 Marketing Data Generator + R2 Upload\n');
  
  // Validate environment
  validateEnv();
  
  const client = createR2Client();
  
  // Generate and upload campaign data
  console.log('📊 Generating 90 days of campaign data...');
  const campaignData = generateCampaignData(90);
  console.log(`   Records: ${campaignData.length}`);
  console.log(`   Date range: ${campaignData[0]?.date} to ${campaignData[campaignData.length - 1]?.date}`);
  console.log(`   Total spend: $${campaignData.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}\n`);
  
  await uploadToR2(client, campaignData, 'marketing-costs.json');
  
  // Generate and upload customer profiles
  console.log('\n👥 Generating customer profiles...');
  const customerProfiles = generateCustomerProfiles(50);
  const vipCount = customerProfiles.filter(p => p.is_vip).length;
  const atRiskCount = customerProfiles.filter(p => p.customer_health_score < 50).length;
  const powerUserCount = customerProfiles.filter(p => ['gold', 'platinum'].includes(p.power_user_tier) && p.videos_watched_external > 100).length;
  
  console.log(`   Total profiles: ${customerProfiles.length}`);
  console.log(`   VIP customers: ${vipCount}`);
  console.log(`   At-risk (health < 50): ${atRiskCount}`);
  console.log(`   Power users (gold/platinum + 100+ videos): ${powerUserCount}`);
  console.log(`   Demo users: leo@posthog.com, leonhardprinz@gmail.com\n`);
  
  await uploadToR2(client, customerProfiles, 'customer-profiles.json');
  
  console.log('\n🎉 Done! Data is now available for PostHog Active CDP demo.');
  console.log('\nNext steps:');
  console.log('1. Connect customer-profiles.json as a Data Warehouse source in PostHog');
  console.log('2. Sync R2 data to person properties');
  console.log('3. Create feature flags: vip_retention_offer, power_user_early_access');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
