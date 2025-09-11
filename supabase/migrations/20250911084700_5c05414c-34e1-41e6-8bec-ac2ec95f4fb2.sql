-- Remove direct SELECT access to profiles table to prevent email exposure
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Revoke SELECT privileges from all roles on profiles table
REVOKE SELECT ON public.profiles FROM authenticated, anon, public;

-- Create secure RPC function that returns sanitized profile data for current user only
CREATE OR REPLACE FUNCTION public.get_my_profiles_public()
RETURNS TABLE (
  id uuid,
  display_name text,
  is_kids_profile boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    pp.id,
    pp.display_name,
    pp.is_kids_profile,
    pp.created_at,
    pp.updated_at
  FROM public.profiles_public pp
  JOIN public.profiles p ON pp.id = p.id
  WHERE p.user_id = auth.uid();
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profiles_public() TO authenticated;