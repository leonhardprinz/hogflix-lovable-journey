-- ============================================================
-- HogFlix Seed Data
-- Run this in the NEW Supabase SQL Editor AFTER 01_schema.sql
-- Seeds: subscription plans (required for signup flows)
-- Video data will be exported from old Supabase separately
-- ============================================================

-- Subscription Plans (idempotent — skip if already exist)
INSERT INTO public.subscription_plans (name, display_name, price_monthly, features, max_profiles, video_quality, is_default)
SELECT 'basic', 'Basic', 0.00,
  '["HD streaming quality", "1 profile", "Standard support", "Watch on any device", "Ad-supported content"]'::jsonb,
  1, 'HD', true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE name = 'basic');

INSERT INTO public.subscription_plans (name, display_name, price_monthly, features, max_profiles, video_quality, is_default)
SELECT 'standard', 'Standard', 9.99,
  '["Full HD streaming", "3 profiles", "Priority support", "Watch on any device", "Ad-free experience", "Download for offline viewing"]'::jsonb,
  3, 'Full HD', false
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE name = 'standard');

INSERT INTO public.subscription_plans (name, display_name, price_monthly, features, max_profiles, video_quality, is_default)
SELECT 'premium', 'Premium', 19.99,
  '["4K + HDR quality", "5 profiles", "Priority support", "Watch on any device", "Ad-free experience", "Download for offline viewing", "Early access to new content", "FlixBuddy AI assistant"]'::jsonb,
  5, '4K + HDR', false
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE name = 'premium');

-- ============================================================
-- Video content data needs to be exported from the old Supabase.
-- Run the export script (04_export_video_data.js) to generate
-- the INSERT statements for:
--   - categories
--   - videos
--   - video_categories
--   - video_assets
--   - video_tags
--   - video_tag_assignments
-- ============================================================
