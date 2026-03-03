-- ============================================================
-- Batch video ratings function
-- Returns avg_rating and rating_count for multiple videos in one call
-- This replaces N+1 calls to get_video_average_rating + get_video_rating_count
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_video_ratings_batch(video_ids UUID[])
RETURNS TABLE (
  video_id UUID,
  avg_rating NUMERIC,
  rating_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vr.video_id,
    COALESCE(AVG(vr.rating::NUMERIC), 0) AS avg_rating,
    COUNT(*)::INTEGER AS rating_count
  FROM public.video_ratings vr
  WHERE vr.video_id = ANY(video_ids)
  GROUP BY vr.video_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
