/**
 * HogFlix Storage Migration Script
 * 
 * Copies all files from OLD Supabase Storage to NEW Supabase Storage.
 * Handles: videos, video-thumbnails, and any other buckets found.
 * 
 * Usage:
 *   SUPABASE_OLD_URL=https://kawxtrzyllgzmmwfddil.supabase.co \
 *   SUPABASE_OLD_KEY=your-old-service-role-key \
 *   SUPABASE_NEW_URL=https://ygbftctnpvxhflpamjrt.supabase.co \
 *   SUPABASE_NEW_KEY=your-new-service-role-key \
 *   node scripts/migration/02_migrate_storage.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ---- Configuration ----
const OLD_URL = process.env.SUPABASE_OLD_URL;
const OLD_KEY = process.env.SUPABASE_OLD_KEY;
const NEW_URL = process.env.SUPABASE_NEW_URL;
const NEW_KEY = process.env.SUPABASE_NEW_KEY;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_OLD_URL, SUPABASE_OLD_KEY, SUPABASE_NEW_URL, SUPABASE_NEW_KEY');
    process.exit(1);
}

const oldSupabase = createClient(OLD_URL, OLD_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});
const newSupabase = createClient(NEW_URL, NEW_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

// Known buckets to migrate
const BUCKETS = ['videos', 'video-thumbnails'];

const TEMP_DIR = path.join(os.tmpdir(), 'hogflix-migration');

async function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
}

async function ensureBucket(supabase, bucketId) {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.id === bucketId);
    if (!exists) {
        console.log(`  📦 Creating bucket "${bucketId}" on new Supabase...`);
        const { error } = await supabase.storage.createBucket(bucketId, { public: false });
        if (error) {
            // Bucket might already exist but not be visible — try proceeding
            console.warn(`  ⚠️  Could not create bucket "${bucketId}": ${error.message}`);
        }
    } else {
        console.log(`  ✅ Bucket "${bucketId}" already exists on new Supabase`);
    }
}

async function listAllFiles(supabase, bucketId, folderPath = '') {
    const allFiles = [];
    const { data, error } = await supabase.storage.from(bucketId).list(folderPath, {
        limit: 1000,
        offset: 0,
    });

    if (error) {
        console.error(`  ❌ Error listing files in ${bucketId}/${folderPath}: ${error.message}`);
        return allFiles;
    }

    if (!data || data.length === 0) return allFiles;

    for (const item of data) {
        const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;

        if (item.id === null) {
            // It's a folder — recurse
            const subFiles = await listAllFiles(supabase, bucketId, itemPath);
            allFiles.push(...subFiles);
        } else {
            // It's a file
            allFiles.push({
                name: item.name,
                path: itemPath,
                size: item.metadata?.size || 0,
            });
        }
    }

    return allFiles;
}

async function downloadFile(supabase, bucketId, filePath) {
    const { data, error } = await supabase.storage.from(bucketId).download(filePath);
    if (error) {
        throw new Error(`Download failed for ${bucketId}/${filePath}: ${error.message}`);
    }
    return data;
}

async function uploadFile(supabase, bucketId, filePath, fileBlob) {
    // Convert Blob to Buffer for upload
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage.from(bucketId).upload(filePath, buffer, {
        upsert: true,
        contentType: fileBlob.type || 'application/octet-stream',
    });

    if (error) {
        throw new Error(`Upload failed for ${bucketId}/${filePath}: ${error.message}`);
    }
}

async function migrateBucket(bucketId) {
    console.log(`\n🗂️  Migrating bucket: ${bucketId}`);
    console.log('─'.repeat(50));

    // 1. Ensure bucket exists on new Supabase
    await ensureBucket(newSupabase, bucketId);

    // 2. List all files in old bucket
    console.log(`  📋 Listing files in old ${bucketId}...`);
    const files = await listAllFiles(oldSupabase, bucketId);
    console.log(`  📊 Found ${files.length} files`);

    if (files.length === 0) {
        console.log(`  ⏭️  No files to migrate in ${bucketId}`);
        return { bucket: bucketId, total: 0, migrated: 0, failed: 0, errors: [] };
    }

    // 3. Check which files already exist in new bucket
    const existingFiles = await listAllFiles(newSupabase, bucketId);
    const existingPaths = new Set(existingFiles.map(f => f.path));

    // 4. Migrate each file
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = `[${i + 1}/${files.length}]`;

        // Skip if already exists
        if (existingPaths.has(file.path)) {
            skipped++;
            console.log(`  ${progress} ⏭️  ${file.path} (already exists)`);
            continue;
        }

        try {
            // Download from old
            const blob = await downloadFile(oldSupabase, bucketId, file.path);

            // Upload to new
            await uploadFile(newSupabase, bucketId, file.path, blob);

            migrated++;
            const sizeKB = Math.round((file.size || 0) / 1024);
            console.log(`  ${progress} ✅ ${file.path} (${sizeKB} KB)`);
        } catch (err) {
            failed++;
            errors.push({ file: file.path, error: err.message });
            console.error(`  ${progress} ❌ ${file.path}: ${err.message}`);
        }
    }

    console.log(`\n  📊 ${bucketId} Summary:`);
    console.log(`     Migrated: ${migrated}`);
    console.log(`     Skipped (already existed): ${skipped}`);
    console.log(`     Failed: ${failed}`);

    return { bucket: bucketId, total: files.length, migrated, skipped, failed, errors };
}

async function main() {
    console.log('🚀 HogFlix Storage Migration');
    console.log('═'.repeat(50));
    console.log(`  Old: ${OLD_URL}`);
    console.log(`  New: ${NEW_URL}`);
    console.log('═'.repeat(50));

    await ensureTempDir();

    const results = [];
    for (const bucket of BUCKETS) {
        const result = await migrateBucket(bucket);
        results.push(result);
    }

    // Final summary
    console.log('\n\n🏁 MIGRATION COMPLETE');
    console.log('═'.repeat(50));

    let totalMigrated = 0;
    let totalFailed = 0;
    let totalFiles = 0;

    for (const r of results) {
        console.log(`  ${r.bucket}: ${r.migrated} migrated, ${r.skipped || 0} skipped, ${r.failed} failed (${r.total} total)`);
        totalMigrated += r.migrated;
        totalFailed += r.failed;
        totalFiles += r.total;
    }

    console.log('─'.repeat(50));
    console.log(`  Total: ${totalMigrated} migrated, ${totalFailed} failed out of ${totalFiles} files`);

    if (totalFailed > 0) {
        console.log('\n⚠️  FAILED FILES:');
        for (const r of results) {
            for (const e of r.errors) {
                console.log(`  - ${r.bucket}/${e.file}: ${e.error}`);
            }
        }
        process.exit(1);
    }
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
