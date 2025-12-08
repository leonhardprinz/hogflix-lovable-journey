/**
 * R2 Upload Script
 * Uploads generated marketing campaign data to Cloudflare R2 bucket
 * Uses S3-compatible API via AWS SDK
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateCampaignData } from './generate-campaign-data';

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
async function uploadToR2(data: object, key: string = 'marketing-costs.json'): Promise<void> {
  const client = createR2Client();
  
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
  
  console.log('✅ Upload complete!');
}

// Main execution
async function main(): Promise<void> {
  console.log('🚀 Marketing Data Generator + R2 Upload\n');
  
  // Validate environment
  validateEnv();
  
  // Generate fresh data
  console.log('📊 Generating 90 days of campaign data...');
  const data = generateCampaignData(90);
  
  // Summary
  console.log(`   Records: ${data.length}`);
  console.log(`   Date range: ${data[0]?.date} to ${data[data.length - 1]?.date}`);
  console.log(`   Total spend: $${data.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}\n`);
  
  // Upload to R2
  await uploadToR2(data);
  
  console.log('\n🎉 Done! Data is now available for PostHog Marketing Analytics.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
