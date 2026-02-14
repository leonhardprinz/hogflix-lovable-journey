/**
 * HogFlix Video Data Export Script
 * 
 * Connects to the OLD Supabase and exports video content data as SQL INSERTs.
 * Outputs a SQL file that can be run on the NEW Supabase.
 * 
 * Usage:
 *   SUPABASE_OLD_URL=https://kawxtrzyllgzmmwfddil.supabase.co \
 *   SUPABASE_OLD_KEY=your-old-service-role-key \
 *   node scripts/migration/04_export_video_data.js > scripts/migration/05_video_data.sql
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = process.env.SUPABASE_OLD_URL;
const OLD_KEY = process.env.SUPABASE_OLD_KEY;

if (!OLD_URL || !OLD_KEY) {
    console.error('❌ Missing: SUPABASE_OLD_URL, SUPABASE_OLD_KEY');
    process.exit(1);
}

const supabase = createClient(OLD_URL, OLD_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

function escapeSQL(str) {
    if (str === null || str === undefined) return 'NULL';
    return `'${String(str).replace(/'/g, "''")}'`;
}

function formatValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') return escapeSQL(JSON.stringify(val));
    return escapeSQL(val);
}

async function exportTable(tableName, columns, orderBy = 'created_at') {
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order(orderBy, { ascending: true });

    if (error) {
        console.error(`-- ❌ Error exporting ${tableName}: ${error.message}`);
        return;
    }

    if (!data || data.length === 0) {
        console.log(`-- ⏭️  No data in ${tableName}`);
        return;
    }

    console.log(`\n-- === ${tableName} (${data.length} rows) ===`);
    console.log(`-- Exported from ${OLD_URL}`);
    console.log(`DELETE FROM public.${tableName};`);

    for (const row of data) {
        const cols = columns.filter(c => row[c] !== undefined);
        const vals = cols.map(c => formatValue(row[c]));
        console.log(`INSERT INTO public.${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    }

    console.log(`-- ✅ ${tableName}: ${data.length} rows exported`);
}

async function main() {
    console.log('-- ============================================================');
    console.log('-- HogFlix Video Data Export');
    console.log(`-- Generated: ${new Date().toISOString()}`);
    console.log(`-- Source: ${OLD_URL}`);
    console.log('-- Run this in the NEW Supabase SQL Editor AFTER 01_schema.sql');
    console.log('-- ============================================================');
    console.log('');
    console.log('BEGIN;');

    // 1. Categories (must be first — videos reference them)
    await exportTable('categories', [
        'id', 'name', 'sort_order', 'created_at', 'updated_at'
    ], 'sort_order');

    // 2. Videos
    await exportTable('videos', [
        'id', 'title', 'description', 'thumbnail_url', 'video_url',
        'category_id', 'duration', 'slug', 'is_public', 'published_at',
        'ai_summary', 'created_at', 'updated_at'
    ], 'created_at');

    // 3. Video Categories (many-to-many)
    await exportTable('video_categories', [
        'video_id', 'category_id', 'created_at'
    ], 'created_at');

    // 4. Video Assets
    await exportTable('video_assets', [
        'id', 'video_id', 'asset_type', 'storage_bucket', 'path',
        'codec', 'width', 'height', 'bitrate', 'duration',
        'created_at', 'updated_at'
    ], 'created_at');

    // 5. Video Tags
    await exportTable('video_tags', [
        'id', 'name', 'color', 'created_at'
    ], 'created_at');

    // 6. Video Tag Assignments
    await exportTable('video_tag_assignments', [
        'video_id', 'tag_id', 'created_at'
    ], 'created_at');

    // 7. Subtitles
    await exportTable('subtitles', [
        'id', 'video_id', 'language_code', 'label', 'storage_bucket',
        'path', 'format', 'created_at', 'updated_at'
    ], 'created_at');

    // 8. Video Thumbnail Tests
    await exportTable('video_thumbnail_tests', [
        'id', 'video_id', 'thumbnail_url', 'variant_name',
        'impressions', 'clicks', 'click_through_rate',
        'is_active', 'is_winner', 'created_at', 'updated_at'
    ], 'created_at');

    console.log('\nCOMMIT;');
    console.log('\n-- ============================================================');
    console.log('-- Export complete. Run this file in the new Supabase SQL Editor.');
    console.log('-- ============================================================');
}

main().catch(err => {
    console.error('-- 💥 Fatal error:', err);
    process.exit(1);
});
