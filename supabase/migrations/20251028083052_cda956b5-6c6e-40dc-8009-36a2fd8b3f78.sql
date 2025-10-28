-- Cleanup function for synthetic data
-- This allows easy removal of all synthetic users and their data

CREATE OR REPLACE FUNCTION public.cleanup_synthetic_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_counts jsonb;
  watch_count int;
  rating_count int;
  watchlist_count int;
  ticket_count int;
  sub_count int;
  profile_count int;
BEGIN
  -- Only admins can run cleanup
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can cleanup synthetic data';
  END IF;

  -- Delete watch progress
  DELETE FROM watch_progress 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'
  );
  GET DIAGNOSTICS watch_count = ROW_COUNT;

  -- Delete video ratings
  DELETE FROM video_ratings 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'
  );
  GET DIAGNOSTICS rating_count = ROW_COUNT;

  -- Delete watchlist entries
  DELETE FROM user_watchlist 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'
  );
  GET DIAGNOSTICS watchlist_count = ROW_COUNT;

  -- Delete support tickets
  DELETE FROM support_tickets 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'
  );
  GET DIAGNOSTICS ticket_count = ROW_COUNT;

  -- Delete subscriptions
  DELETE FROM user_subscriptions 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@hogflix-synthetic.test'
  );
  GET DIAGNOSTICS sub_count = ROW_COUNT;

  -- Delete profiles
  DELETE FROM profiles 
  WHERE email LIKE '%@hogflix-synthetic.test';
  GET DIAGNOSTICS profile_count = ROW_COUNT;

  -- Note: Auth users must be deleted via Supabase Admin API
  -- This function only cleans up the public schema

  deleted_counts = jsonb_build_object(
    'watch_progress', watch_count,
    'video_ratings', rating_count,
    'user_watchlist', watchlist_count,
    'support_tickets', ticket_count,
    'user_subscriptions', sub_count,
    'profiles', profile_count,
    'note', 'Auth users must be deleted separately via Supabase Admin API'
  );

  RETURN deleted_counts;
END;
$$;

COMMENT ON FUNCTION public.cleanup_synthetic_data() IS 'Removes all synthetic user data from public schema. Auth users must be deleted separately.';

-- Function to count synthetic data
CREATE OR REPLACE FUNCTION public.count_synthetic_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counts jsonb;
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

COMMENT ON FUNCTION public.count_synthetic_data() IS 'Returns counts of synthetic data across all tables';
