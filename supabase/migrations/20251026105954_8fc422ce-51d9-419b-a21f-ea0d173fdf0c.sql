-- Fix the security definer view warning by recreating as a regular view
DROP VIEW IF EXISTS public.video_ratings_aggregate;

-- Recreate as regular view (not security definer)
-- This view is safe because it only exposes aggregate data, no user_ids
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

-- Re-grant access
GRANT SELECT ON public.video_ratings_aggregate TO authenticated;
GRANT SELECT ON public.video_ratings_aggregate TO anon;