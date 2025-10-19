-- Phase 1: Database Schema for Admin Analytics

-- 1. Create video_analytics table for pre-calculated metrics
CREATE TABLE video_analytics (
  video_id UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  
  -- Engagement metrics
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  total_watch_time_seconds BIGINT DEFAULT 0,
  avg_watch_time_seconds INTEGER DEFAULT 0,
  
  -- Completion metrics
  completion_rate NUMERIC(5,2) DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  started_count INTEGER DEFAULT 0,
  
  -- Drop-off analysis
  retention_at_25 NUMERIC(5,2) DEFAULT 0,
  retention_at_50 NUMERIC(5,2) DEFAULT 0,
  retention_at_75 NUMERIC(5,2) DEFAULT 0,
  
  -- Rating metrics
  avg_rating NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- Engagement scores
  watchlist_count INTEGER DEFAULT 0,
  replay_count INTEGER DEFAULT 0,
  
  -- Time-based metrics
  views_today INTEGER DEFAULT 0,
  views_this_week INTEGER DEFAULT 0,
  views_this_month INTEGER DEFAULT 0,
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_analytics_completion ON video_analytics(completion_rate DESC);
CREATE INDEX idx_video_analytics_views ON video_analytics(total_views DESC);
CREATE INDEX idx_video_analytics_rating ON video_analytics(avg_rating DESC);

-- 2. Create video_tags table
CREATE TABLE video_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_tag_assignments (
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES video_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (video_id, tag_id)
);

CREATE INDEX idx_video_tag_assignments_video ON video_tag_assignments(video_id);
CREATE INDEX idx_video_tag_assignments_tag ON video_tag_assignments(tag_id);

-- 3. Create video_thumbnail_tests table
CREATE TABLE video_thumbnail_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  thumbnail_url TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  
  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  click_through_rate NUMERIC(5,2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_winner BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(video_id, variant_name)
);

CREATE INDEX idx_thumbnail_tests_video ON video_thumbnail_tests(video_id);

-- 4. Create admin_activity_log table
CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_activity_user ON admin_activity_log(admin_user_id);
CREATE INDEX idx_admin_activity_action ON admin_activity_log(action_type);
CREATE INDEX idx_admin_activity_created ON admin_activity_log(created_at DESC);

-- 5. RLS Policies
ALTER TABLE video_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view analytics" ON video_analytics FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins can manage analytics" ON video_analytics FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

ALTER TABLE video_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tags" ON video_tags FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

ALTER TABLE video_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tag assignments" ON video_tag_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

ALTER TABLE video_thumbnail_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage thumbnail tests" ON video_thumbnail_tests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view activity log" ON admin_activity_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert activity log" ON admin_activity_log FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- 6. Function to refresh video analytics
CREATE OR REPLACE FUNCTION refresh_video_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate analytics for all videos with watch progress
  INSERT INTO video_analytics (
    video_id,
    total_views,
    unique_viewers,
    total_watch_time_seconds,
    avg_watch_time_seconds,
    completion_rate,
    completed_count,
    started_count,
    retention_at_25,
    retention_at_50,
    retention_at_75,
    avg_rating,
    rating_count,
    watchlist_count,
    replay_count,
    views_today,
    views_this_week,
    views_this_month,
    last_calculated_at
  )
  SELECT 
    wp.video_id,
    COUNT(*) as total_views,
    COUNT(DISTINCT wp.user_id) as unique_viewers,
    COALESCE(SUM(wp.progress_seconds), 0) as total_watch_time_seconds,
    COALESCE(AVG(wp.progress_seconds)::INTEGER, 0) as avg_watch_time_seconds,
    ROUND((COUNT(*) FILTER (WHERE wp.completed = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as completion_rate,
    COUNT(*) FILTER (WHERE wp.completed = true) as completed_count,
    COUNT(*) as started_count,
    ROUND((COUNT(*) FILTER (WHERE wp.progress_percentage >= 25)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as retention_at_25,
    ROUND((COUNT(*) FILTER (WHERE wp.progress_percentage >= 50)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as retention_at_50,
    ROUND((COUNT(*) FILTER (WHERE wp.progress_percentage >= 75)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as retention_at_75,
    COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM video_ratings WHERE video_id = wp.video_id), 0) as avg_rating,
    COALESCE((SELECT COUNT(*)::INTEGER FROM video_ratings WHERE video_id = wp.video_id), 0) as rating_count,
    COALESCE((SELECT COUNT(*)::INTEGER FROM user_watchlist WHERE video_id = wp.video_id), 0) as watchlist_count,
    COUNT(DISTINCT wp.user_id) FILTER (WHERE wp.user_id IN (
      SELECT user_id FROM watch_progress wp2 WHERE wp2.video_id = wp.video_id GROUP BY user_id HAVING COUNT(*) > 1
    )) as replay_count,
    COUNT(*) FILTER (WHERE wp.last_watched_at > NOW() - INTERVAL '1 day') as views_today,
    COUNT(*) FILTER (WHERE wp.last_watched_at > NOW() - INTERVAL '7 days') as views_this_week,
    COUNT(*) FILTER (WHERE wp.last_watched_at > NOW() - INTERVAL '30 days') as views_this_month,
    NOW()
  FROM watch_progress wp
  GROUP BY wp.video_id
  ON CONFLICT (video_id) DO UPDATE SET
    total_views = EXCLUDED.total_views,
    unique_viewers = EXCLUDED.unique_viewers,
    total_watch_time_seconds = EXCLUDED.total_watch_time_seconds,
    avg_watch_time_seconds = EXCLUDED.avg_watch_time_seconds,
    completion_rate = EXCLUDED.completion_rate,
    completed_count = EXCLUDED.completed_count,
    started_count = EXCLUDED.started_count,
    retention_at_25 = EXCLUDED.retention_at_25,
    retention_at_50 = EXCLUDED.retention_at_50,
    retention_at_75 = EXCLUDED.retention_at_75,
    avg_rating = EXCLUDED.avg_rating,
    rating_count = EXCLUDED.rating_count,
    watchlist_count = EXCLUDED.watchlist_count,
    replay_count = EXCLUDED.replay_count,
    views_today = EXCLUDED.views_today,
    views_this_week = EXCLUDED.views_this_week,
    views_this_month = EXCLUDED.views_this_month,
    last_calculated_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Initial analytics calculation
SELECT refresh_video_analytics();