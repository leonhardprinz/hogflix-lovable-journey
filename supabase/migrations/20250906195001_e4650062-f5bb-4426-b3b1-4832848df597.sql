-- Security hardening migration: tighten RLS to authenticated-only, add support ticket rate limiting, and ensure updated_at triggers

-- 1) Ensure RLS is enabled on key tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Re-scope SELECT policies to authenticated role only (prevent anon access)
-- Categories
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON public.categories;
CREATE POLICY "Categories are viewable by authenticated users"
ON public.categories
FOR SELECT
TO authenticated
USING (true);

-- Video-category links
DROP POLICY IF EXISTS "Video-category links are viewable by authenticated users" ON public.video_categories;
CREATE POLICY "Video-category links are viewable by authenticated users"
ON public.video_categories
FOR SELECT
TO authenticated
USING (true);

-- Videos
DROP POLICY IF EXISTS "Videos are viewable by authenticated users" ON public.videos;
CREATE POLICY "Videos are viewable by authenticated users"
ON public.videos
FOR SELECT
TO authenticated
USING (true);

-- Video assets
DROP POLICY IF EXISTS "Video assets are viewable by authenticated users" ON public.video_assets;
CREATE POLICY "Video assets are viewable by authenticated users"
ON public.video_assets
FOR SELECT
TO authenticated
USING (true);

-- Subtitles
DROP POLICY IF EXISTS "Subtitles are viewable by authenticated users" ON public.subtitles;
CREATE POLICY "Subtitles are viewable by authenticated users"
ON public.subtitles
FOR SELECT
TO authenticated
USING (true);

-- Support tickets (scope to authenticated explicitly)
DROP POLICY IF EXISTS "Users can create their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can create their own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) Add rate limiting and user_id auto-population for support tickets
CREATE OR REPLACE FUNCTION public.set_support_ticket_user_and_throttle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tickets_last_hour integer;
  max_per_hour integer := 5;
BEGIN
  -- Auto-populate user_id from auth context if not provided
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  -- If still no user_id (unauthenticated), block early
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create support tickets';
  END IF;

  -- Enforce per-user rate limit
  SELECT count(*)
    INTO tickets_last_hour
  FROM public.support_tickets
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';

  IF tickets_last_hour >= max_per_hour THEN
    RAISE EXCEPTION 'Support ticket rate limit exceeded. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_and_rate_limit ON public.support_tickets;
CREATE TRIGGER set_user_and_rate_limit
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_support_ticket_user_and_throttle();

-- Index to support rate limiting query
CREATE INDEX IF NOT EXISTS support_tickets_user_created_at_idx
ON public.support_tickets (user_id, created_at DESC);

-- 4) Ensure updated_at columns are maintained via triggers
-- Uses existing public.update_updated_at_column()
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_assets_updated_at ON public.video_assets;
CREATE TRIGGER update_video_assets_updated_at
BEFORE UPDATE ON public.video_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subtitles_updated_at ON public.subtitles;
CREATE TRIGGER update_subtitles_updated_at
BEFORE UPDATE ON public.subtitles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();