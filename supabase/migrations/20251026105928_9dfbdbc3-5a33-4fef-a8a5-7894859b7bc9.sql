-- Phase 1 Critical Security Fixes

-- 1. Fix video_ratings RLS policy to prevent user data exposure
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all ratings" ON public.video_ratings;

-- Create new restrictive policy - users can only see their own ratings
CREATE POLICY "Users can view their own ratings"
ON public.video_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create a secure view for aggregate rating data (no user_id exposure)
CREATE OR REPLACE VIEW public.video_ratings_aggregate AS
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

-- Grant access to the view
GRANT SELECT ON public.video_ratings_aggregate TO authenticated;
GRANT SELECT ON public.video_ratings_aggregate TO anon;

-- 2. Make support_tickets.user_id NOT NULL for better security
-- First update any existing null values (shouldn't be any due to trigger)
UPDATE public.support_tickets
SET user_id = auth.uid()
WHERE user_id IS NULL AND auth.uid() IS NOT NULL;

-- Now make the column NOT NULL
ALTER TABLE public.support_tickets 
ALTER COLUMN user_id SET NOT NULL;

-- 3. Add index for better performance on the fixed RLS policy
CREATE INDEX IF NOT EXISTS idx_video_ratings_user_video 
ON public.video_ratings(user_id, video_id);

-- 4. Add index for support tickets user lookup
CREATE INDEX IF NOT EXISTS idx_support_tickets_user 
ON public.support_tickets(user_id, created_at DESC);