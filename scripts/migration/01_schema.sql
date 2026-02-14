-- ============================================================
-- HogFlix Consolidated Schema Migration
-- Run this in the NEW Supabase SQL Editor (ygbftctnpvxhflpamjrt)
-- This script is IDEMPOTENT — safe to run multiple times
-- ============================================================

-- ============ PHASE 0: Utility Functions ============

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============ PHASE 1: Enums ============

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_type AS ENUM ('original','hls','trailer','preview');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============ PHASE 2: Core Tables ============

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Videos
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL DEFAULT 0,
  slug TEXT,
  is_public BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT,
  email TEXT,
  is_kids_profile BOOLEAN NOT NULL DEFAULT false,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT true,
  early_access_features TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles Public (non-sensitive projection)
CREATE TABLE IF NOT EXISTS public.profiles_public (
  id UUID PRIMARY KEY,
  display_name TEXT,
  is_kids_profile BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT profiles_public_id_fkey
    FOREIGN KEY (id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

-- Video Assets (multiple encodings per video)
CREATE TABLE IF NOT EXISTS public.video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  asset_type public.asset_type NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'videos',
  path TEXT NOT NULL,
  codec TEXT,
  width INTEGER,
  height INTEGER,
  bitrate INTEGER,
  duration INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subtitles
CREATE TABLE IF NOT EXISTS public.subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  label TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'videos',
  path TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'vtt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Video Categories (many-to-many)
CREATE TABLE IF NOT EXISTS public.video_categories (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, category_id)
);

-- Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Video Ratings
CREATE TABLE IF NOT EXISTS public.video_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, profile_id)
);

-- User Watchlist
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, profile_id, video_id)
);

-- Chat Conversations (FlixBuddy)
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Watch Progress
CREATE TABLE IF NOT EXISTS public.watch_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  video_id UUID NOT NULL,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  progress_percentage NUMERIC NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed BOOLEAN NOT NULL DEFAULT false,
  session_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, profile_id, video_id)
);

-- Add FK from watch_progress to videos (IF NOT EXISTS workaround)
DO $$ BEGIN
  ALTER TABLE public.watch_progress
    ADD CONSTRAINT fk_watch_progress_video
    FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_profiles INTEGER NOT NULL DEFAULT 1,
  video_quality TEXT NOT NULL DEFAULT 'HD',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  payment_intent TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Video Analytics
CREATE TABLE IF NOT EXISTS public.video_analytics (
  video_id UUID PRIMARY KEY REFERENCES public.videos(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  total_watch_time_seconds BIGINT DEFAULT 0,
  avg_watch_time_seconds INTEGER DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  started_count INTEGER DEFAULT 0,
  retention_at_25 NUMERIC(5,2) DEFAULT 0,
  retention_at_50 NUMERIC(5,2) DEFAULT 0,
  retention_at_75 NUMERIC(5,2) DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  watchlist_count INTEGER DEFAULT 0,
  replay_count INTEGER DEFAULT 0,
  views_today INTEGER DEFAULT 0,
  views_this_week INTEGER DEFAULT 0,
  views_this_month INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Tags
CREATE TABLE IF NOT EXISTS public.video_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Tag Assignments
CREATE TABLE IF NOT EXISTS public.video_tag_assignments (
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.video_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (video_id, tag_id)
);

-- Video Thumbnail Tests
CREATE TABLE IF NOT EXISTS public.video_thumbnail_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  thumbnail_url TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  click_through_rate NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, variant_name)
);

-- Admin Activity Log
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Config table (if referenced in screenshots)
CREATE TABLE IF NOT EXISTS public.config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table (if referenced in screenshots)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  provider TEXT,
  provider_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota Snapshots
CREATE TABLE IF NOT EXISTS public.quota_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ PHASE 3: Indexes ============

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_videos_category_id ON public.videos(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS videos_slug_idx ON public.videos(slug);
CREATE INDEX IF NOT EXISTS videos_published_at_idx ON public.videos(published_at DESC);
CREATE INDEX IF NOT EXISTS videos_is_public_idx ON public.videos(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_video_assets_video_id ON public.video_assets(video_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_type ON public.video_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_subtitles_video_id ON public.subtitles(video_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_lang ON public.subtitles(language_code);
CREATE INDEX IF NOT EXISTS idx_video_categories_video_id ON public.video_categories(video_id);
CREATE INDEX IF NOT EXISTS idx_video_categories_category_id ON public.video_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_video_ratings_user_video ON public.video_ratings(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_user_profile ON public.watch_progress(user_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_last_watched ON public.watch_progress(last_watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_tag_assignments_video ON public.video_tag_assignments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_tag_assignments_tag ON public.video_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_tests_video ON public.video_thumbnail_tests(video_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_user ON public.admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON public.admin_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_created_at_idx ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);

-- ============ PHASE 4: RLS Policies ============

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_thumbnail_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Categories: authenticated only
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON public.categories;
CREATE POLICY "Categories are viewable by authenticated users"
ON public.categories FOR SELECT TO authenticated USING (true);

-- Videos: public viewing (for previews and newsletter)
DROP POLICY IF EXISTS "Videos are publicly viewable for previews" ON public.videos;
CREATE POLICY "Videos are publicly viewable for previews"
ON public.videos FOR SELECT USING (true);

-- Videos: admin CRUD
DROP POLICY IF EXISTS "Admins can insert videos" ON public.videos;
CREATE POLICY "Admins can insert videos" ON public.videos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Authenticated users can insert videos" ON public.videos;
CREATE POLICY "Authenticated users can insert videos" ON public.videos FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update videos" ON public.videos;
CREATE POLICY "Admins can update videos" ON public.videos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Admins can update video summaries" ON public.videos;
CREATE POLICY "Admins can update video summaries" ON public.videos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Admins can delete videos" ON public.videos;
CREATE POLICY "Admins can delete videos" ON public.videos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Categories: admin CRUD
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
CREATE POLICY "Authenticated users can insert categories" ON public.categories FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Profiles: user access
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Profiles Public: authenticated read access
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles_public;
CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles_public FOR SELECT TO authenticated USING (true);

-- Video Assets
DROP POLICY IF EXISTS "Video assets are viewable by authenticated users" ON public.video_assets;
CREATE POLICY "Video assets are viewable by authenticated users"
ON public.video_assets FOR SELECT TO authenticated USING (true);

-- Subtitles
DROP POLICY IF EXISTS "Subtitles are viewable by authenticated users" ON public.subtitles;
CREATE POLICY "Subtitles are viewable by authenticated users"
ON public.subtitles FOR SELECT TO authenticated USING (true);

-- Video Categories
DROP POLICY IF EXISTS "Video-category links are viewable by authenticated users" ON public.video_categories;
CREATE POLICY "Video-category links are viewable by authenticated users"
ON public.video_categories FOR SELECT TO authenticated USING (true);

-- Support Tickets
DROP POLICY IF EXISTS "Users can create their own tickets" ON public.support_tickets;
CREATE POLICY "Users can create their own tickets" ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own tickets" ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all support tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all support tickets" ON public.support_tickets FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support tickets" ON public.support_tickets FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- User Roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Video Ratings: users can only see their own
DROP POLICY IF EXISTS "Users can view their own ratings" ON public.video_ratings;
CREATE POLICY "Users can view their own ratings" ON public.video_ratings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own ratings" ON public.video_ratings;
CREATE POLICY "Users can insert their own ratings" ON public.video_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ratings" ON public.video_ratings;
CREATE POLICY "Users can update their own ratings" ON public.video_ratings FOR UPDATE
USING (auth.uid() = user_id);

-- User Watchlist
DROP POLICY IF EXISTS "Users can view their own watchlist" ON public.user_watchlist;
CREATE POLICY "Users can view their own watchlist" ON public.user_watchlist FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to their own watchlist" ON public.user_watchlist;
CREATE POLICY "Users can add to their own watchlist" ON public.user_watchlist FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from their own watchlist" ON public.user_watchlist;
CREATE POLICY "Users can remove from their own watchlist" ON public.user_watchlist FOR DELETE
USING (auth.uid() = user_id);

-- Chat Conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view their own conversations" ON public.chat_conversations FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can create their own conversations" ON public.chat_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can update their own conversations" ON public.chat_conversations FOR UPDATE
USING (auth.uid() = user_id);

-- Chat Messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages FOR SELECT
USING (conversation_id IN (SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can create messages in their conversations" ON public.chat_messages FOR INSERT
WITH CHECK (conversation_id IN (SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()));

-- Watch Progress
DROP POLICY IF EXISTS "Users can view their own watch progress" ON public.watch_progress;
CREATE POLICY "Users can view their own watch progress" ON public.watch_progress FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own watch progress" ON public.watch_progress;
CREATE POLICY "Users can create their own watch progress" ON public.watch_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own watch progress" ON public.watch_progress;
CREATE POLICY "Users can update their own watch progress" ON public.watch_progress FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own watch progress" ON public.watch_progress;
CREATE POLICY "Users can delete their own watch progress" ON public.watch_progress FOR DELETE
USING (auth.uid() = user_id);

-- Subscription Plans: everyone can view
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.subscription_plans;
CREATE POLICY "Plans are viewable by everyone" ON public.subscription_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can modify plans" ON public.subscription_plans;
CREATE POLICY "Admins can modify plans" ON public.subscription_plans FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- User Subscriptions
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can create their own subscription" ON public.user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can update their own subscription" ON public.user_subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.user_subscriptions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can update subscriptions" ON public.user_subscriptions FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Video Analytics
DROP POLICY IF EXISTS "Admins can view analytics" ON public.video_analytics;
CREATE POLICY "Admins can view analytics" ON public.video_analytics FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Admins can manage analytics" ON public.video_analytics;
CREATE POLICY "Admins can manage analytics" ON public.video_analytics FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Video Tags
DROP POLICY IF EXISTS "Everyone can view tags" ON public.video_tags;
CREATE POLICY "Everyone can view tags" ON public.video_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage tags" ON public.video_tags;
CREATE POLICY "Admins manage tags" ON public.video_tags FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Video Tag Assignments
DROP POLICY IF EXISTS "Admins manage tag assignments" ON public.video_tag_assignments;
CREATE POLICY "Admins manage tag assignments" ON public.video_tag_assignments FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Video Thumbnail Tests
DROP POLICY IF EXISTS "Admins manage thumbnail tests" ON public.video_thumbnail_tests;
CREATE POLICY "Admins manage thumbnail tests" ON public.video_thumbnail_tests FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Admin Activity Log
DROP POLICY IF EXISTS "Admins view activity log" ON public.admin_activity_log;
CREATE POLICY "Admins view activity log" ON public.admin_activity_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert activity log" ON public.admin_activity_log;
CREATE POLICY "Admins insert activity log" ON public.admin_activity_log FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- ============ PHASE 5: Storage Buckets + Policies ============

INSERT INTO storage.buckets (id, name, public)
SELECT 'videos', 'videos', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'videos');

INSERT INTO storage.buckets (id, name, public)
SELECT 'video-thumbnails', 'video-thumbnails', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'video-thumbnails');

-- Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload to videos and thumbnails" ON storage.objects;
CREATE POLICY "Authenticated users can upload to videos and thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('videos', 'video-thumbnails'));

DROP POLICY IF EXISTS "Authenticated users can update files in videos and thumbnails" ON storage.objects;
CREATE POLICY "Authenticated users can update files in videos and thumbnails"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('videos', 'video-thumbnails'))
WITH CHECK (bucket_id IN ('videos', 'video-thumbnails'));

DROP POLICY IF EXISTS "Admins can delete files in videos and thumbnails" ON storage.objects;
CREATE POLICY "Admins can delete files in videos and thumbnails"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('videos', 'video-thumbnails')
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

-- ============ PHASE 6: Functions ============

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY
     CASE role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 WHEN 'user' THEN 3 END LIMIT 1),
    'user'::app_role
  )
$$;

-- Video rating functions
CREATE OR REPLACE FUNCTION public.get_video_average_rating(video_id_param UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (SELECT COALESCE(AVG(rating::NUMERIC), 0) FROM public.video_ratings WHERE video_id = video_id_param);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_video_rating_count(video_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM public.video_ratings WHERE video_id = video_id_param);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_video_rating(video_id_param UUID, profile_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT rating FROM public.video_ratings WHERE video_id = video_id_param AND profile_id = profile_id_param LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Watchlist check function
CREATE OR REPLACE FUNCTION public.is_video_in_watchlist(video_id_param uuid, profile_id_param uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_watchlist WHERE video_id = video_id_param AND profile_id = profile_id_param AND user_id = auth.uid()
  );
END;
$$;

-- Subscription function
CREATE OR REPLACE FUNCTION public.get_user_subscription(_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  subscription_id UUID, plan_id UUID, plan_name TEXT, plan_display_name TEXT,
  price_monthly NUMERIC, features JSONB, max_profiles INTEGER, video_quality TEXT,
  status TEXT, started_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT us.id, sp.id, sp.name, sp.display_name, sp.price_monthly, sp.features,
    sp.max_profiles, sp.video_quality, us.status, us.started_at, us.expires_at
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = _user_id AND us.status = 'active' LIMIT 1;
$$;

-- Get profiles public function
DROP FUNCTION IF EXISTS public.get_my_profiles_public();
CREATE FUNCTION public.get_my_profiles_public()
RETURNS TABLE(
  id uuid, display_name text, is_kids_profile boolean, early_access_features text[],
  created_at timestamp with time zone, updated_at timestamp with time zone
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT pp.id, pp.display_name, pp.is_kids_profile, p.early_access_features, pp.created_at, pp.updated_at
  FROM public.profiles_public pp
  JOIN public.profiles p ON pp.id = p.id
  WHERE p.user_id = auth.uid();
$function$;

-- Update early access features function
CREATE OR REPLACE FUNCTION public.update_early_access_features(profile_id_param UUID, features_param TEXT[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated_profile jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = profile_id_param AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this profile';
  END IF;
  UPDATE public.profiles SET early_access_features = features_param, updated_at = NOW()
  WHERE id = profile_id_param
  RETURNING jsonb_build_object('id', id, 'early_access_features', early_access_features, 'updated_at', updated_at)
  INTO updated_profile;
  IF updated_profile IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN updated_profile;
END;
$$;

-- Profiles public sync function
CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (tg_op = 'INSERT' OR tg_op = 'UPDATE') THEN
    INSERT INTO public.profiles_public (id, display_name, is_kids_profile, created_at, updated_at)
    VALUES (new.id, new.display_name, new.is_kids_profile, new.created_at, new.updated_at)
    ON CONFLICT (id) DO UPDATE SET
      display_name = excluded.display_name, is_kids_profile = excluded.is_kids_profile,
      created_at = excluded.created_at, updated_at = excluded.updated_at;
    RETURN new;
  ELSIF (tg_op = 'DELETE') THEN
    DELETE FROM public.profiles_public WHERE id = old.id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

-- Support ticket rate limiter
CREATE OR REPLACE FUNCTION public.set_support_ticket_user_and_throttle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tickets_last_hour integer;
  max_per_hour integer := 5;
BEGIN
  IF NEW.user_id IS NULL THEN NEW.user_id := auth.uid(); END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Authentication required to create support tickets'; END IF;
  SELECT count(*) INTO tickets_last_hour FROM public.support_tickets WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour';
  IF tickets_last_hour >= max_per_hour THEN RAISE EXCEPTION 'Support ticket rate limit exceeded. Please try again later.'; END IF;
  RETURN NEW;
END;
$$;

-- Auto-assign roles on profile creation
CREATE OR REPLACE FUNCTION public.make_first_user_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'user'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-assign default subscription
CREATE OR REPLACE FUNCTION public.assign_default_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_plan_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.user_id) THEN
    SELECT id INTO default_plan_id FROM public.subscription_plans WHERE is_default = true LIMIT 1;
    IF default_plan_id IS NOT NULL THEN
      INSERT INTO public.user_subscriptions (user_id, plan_id, status) VALUES (NEW.user_id, default_plan_id, 'active');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Refresh video analytics function
CREATE OR REPLACE FUNCTION public.refresh_video_analytics()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO video_analytics (
    video_id, total_views, unique_viewers, total_watch_time_seconds, avg_watch_time_seconds,
    completion_rate, completed_count, started_count, retention_at_25, retention_at_50, retention_at_75,
    avg_rating, rating_count, watchlist_count, replay_count,
    views_today, views_this_week, views_this_month, last_calculated_at
  )
  SELECT
    wp.video_id, COUNT(*), COUNT(DISTINCT wp.user_id),
    COALESCE(SUM(wp.progress_seconds), 0), COALESCE(AVG(wp.progress_seconds)::INTEGER, 0),
    ROUND((COUNT(*) FILTER (WHERE wp.completed = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2),
    COUNT(*) FILTER (WHERE wp.completed = true), COUNT(*),
    ROUND((COUNT(*) FILTER (WHERE wp.progress_percentage >= 25)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2),
    ROUND((COUNT(*) FILTER (WHERE wp.progress_percentage >= 50)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2),
    ROUND((COUNT(*) FILTER (WHERE wp.progress_percentage >= 75)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2),
    COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM video_ratings WHERE video_id = wp.video_id), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM video_ratings WHERE video_id = wp.video_id), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM user_watchlist WHERE video_id = wp.video_id), 0),
    COUNT(DISTINCT wp.user_id) FILTER (WHERE wp.user_id IN (
      SELECT user_id FROM watch_progress wp2 WHERE wp2.video_id = wp.video_id GROUP BY user_id HAVING COUNT(*) > 1
    )),
    COUNT(*) FILTER (WHERE wp.last_watched_at > NOW() - INTERVAL '1 day'),
    COUNT(*) FILTER (WHERE wp.last_watched_at > NOW() - INTERVAL '7 days'),
    COUNT(*) FILTER (WHERE wp.last_watched_at > NOW() - INTERVAL '30 days'),
    NOW()
  FROM watch_progress wp
  GROUP BY wp.video_id
  ON CONFLICT (video_id) DO UPDATE SET
    total_views = EXCLUDED.total_views, unique_viewers = EXCLUDED.unique_viewers,
    total_watch_time_seconds = EXCLUDED.total_watch_time_seconds, avg_watch_time_seconds = EXCLUDED.avg_watch_time_seconds,
    completion_rate = EXCLUDED.completion_rate, completed_count = EXCLUDED.completed_count,
    started_count = EXCLUDED.started_count, retention_at_25 = EXCLUDED.retention_at_25,
    retention_at_50 = EXCLUDED.retention_at_50, retention_at_75 = EXCLUDED.retention_at_75,
    avg_rating = EXCLUDED.avg_rating, rating_count = EXCLUDED.rating_count,
    watchlist_count = EXCLUDED.watchlist_count, replay_count = EXCLUDED.replay_count,
    views_today = EXCLUDED.views_today, views_this_week = EXCLUDED.views_this_week,
    views_this_month = EXCLUDED.views_this_month,
    last_calculated_at = NOW(), updated_at = NOW();
END;
$$;

-- Bulk update videos function (admin)
CREATE OR REPLACE FUNCTION public.bulk_update_videos(video_ids UUID[], updates JSONB)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE videos SET
    category_id = COALESCE((updates->>'category_id')::UUID, category_id),
    is_public = COALESCE((updates->>'is_public')::BOOLEAN, is_public),
    updated_at = NOW()
  WHERE id = ANY(video_ids);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  INSERT INTO admin_activity_log (admin_user_id, action_type, entity_type, details)
  VALUES (auth.uid(), 'bulk_update', 'video', jsonb_build_object('video_ids', video_ids, 'updated_count', updated_count, 'changes', updates));
  RETURN updated_count;
END;
$$;

-- Cleanup synthetic data
CREATE OR REPLACE FUNCTION public.cleanup_synthetic_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_counts jsonb; watch_count int; rating_count int; watchlist_count int;
  ticket_count int; sub_count int; profile_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Only admins can cleanup synthetic data'; END IF;
  DELETE FROM watch_progress WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'); GET DIAGNOSTICS watch_count = ROW_COUNT;
  DELETE FROM video_ratings WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'); GET DIAGNOSTICS rating_count = ROW_COUNT;
  DELETE FROM user_watchlist WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'); GET DIAGNOSTICS watchlist_count = ROW_COUNT;
  DELETE FROM support_tickets WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'); GET DIAGNOSTICS ticket_count = ROW_COUNT;
  DELETE FROM user_subscriptions WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'); GET DIAGNOSTICS sub_count = ROW_COUNT;
  DELETE FROM profiles WHERE email LIKE '%@hogflix-synthetic.test'; GET DIAGNOSTICS profile_count = ROW_COUNT;
  deleted_counts = jsonb_build_object('watch_progress', watch_count, 'video_ratings', rating_count,
    'user_watchlist', watchlist_count, 'support_tickets', ticket_count, 'user_subscriptions', sub_count,
    'profiles', profile_count, 'note', 'Auth users must be deleted separately via Supabase Admin API');
  RETURN deleted_counts;
END;
$$;

-- Count synthetic data
CREATE OR REPLACE FUNCTION public.count_synthetic_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE counts jsonb;
BEGIN
  counts = jsonb_build_object(
    'profiles', (SELECT COUNT(*) FROM profiles WHERE email LIKE '%@hogflix-synthetic.test'),
    'subscriptions', (SELECT COUNT(*) FROM user_subscriptions WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test')),
    'watch_progress', (SELECT COUNT(*) FROM watch_progress WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test')),
    'video_ratings', (SELECT COUNT(*) FROM video_ratings WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test')),
    'watchlist', (SELECT COUNT(*) FROM user_watchlist WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test')),
    'support_tickets', (SELECT COUNT(*) FROM support_tickets WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'))
  );
  RETURN counts;
END;
$$;

-- ============ PHASE 7: Triggers ============

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_assets_updated_at ON public.video_assets;
CREATE TRIGGER update_video_assets_updated_at BEFORE UPDATE ON public.video_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subtitles_updated_at ON public.subtitles;
CREATE TRIGGER update_subtitles_updated_at BEFORE UPDATE ON public.subtitles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_ratings_updated_at ON public.video_ratings;
CREATE TRIGGER update_video_ratings_updated_at BEFORE UPDATE ON public.video_ratings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_watchlist_updated_at ON public.user_watchlist;
CREATE TRIGGER update_user_watchlist_updated_at BEFORE UPDATE ON public.user_watchlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_watch_progress_updated_at ON public.watch_progress;
CREATE TRIGGER update_watch_progress_updated_at BEFORE UPDATE ON public.watch_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profile sync triggers
DROP TRIGGER IF EXISTS profiles_sync_public_aiud ON public.profiles;
CREATE TRIGGER profiles_sync_public_aiud AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profiles_public();

DROP TRIGGER IF EXISTS profiles_sync_public_ad ON public.profiles;
CREATE TRIGGER profiles_sync_public_ad AFTER DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profiles_public();

-- Support ticket rate limiter trigger
DROP TRIGGER IF EXISTS set_user_and_rate_limit ON public.support_tickets;
CREATE TRIGGER set_user_and_rate_limit BEFORE INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_support_ticket_user_and_throttle();

-- Auto-assign roles on profile creation
DROP TRIGGER IF EXISTS assign_user_role_trigger ON public.profiles;
CREATE TRIGGER assign_user_role_trigger AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.make_first_user_admin();

-- Auto-assign default subscription
DROP TRIGGER IF EXISTS assign_default_subscription_trigger ON public.profiles;
CREATE TRIGGER assign_default_subscription_trigger AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.assign_default_subscription();

-- ============ PHASE 8: Views ============

DROP VIEW IF EXISTS public.video_ratings_aggregate;
CREATE VIEW public.video_ratings_aggregate AS
SELECT
  video_id,
  COUNT(*)::integer as rating_count,
  AVG(rating)::numeric(3,2) as avg_rating,
  COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
  COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
  COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
  COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
  COUNT(*) FILTER (WHERE rating = 5) as rating_5_count
FROM public.video_ratings
GROUP BY video_id;

GRANT SELECT ON public.video_ratings_aggregate TO authenticated;
GRANT SELECT ON public.video_ratings_aggregate TO anon;

-- ============ PHASE 9: Grant Permissions ============

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- ============ DONE ============
-- Next: Run 03_seed_data.sql to insert content data
