-- Drop and recreate get_my_profiles_public with early_access_features
DROP FUNCTION IF EXISTS public.get_my_profiles_public();

CREATE FUNCTION public.get_my_profiles_public()
RETURNS TABLE(
  id uuid, 
  display_name text, 
  is_kids_profile boolean, 
  early_access_features text[],
  created_at timestamp with time zone, 
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    pp.id,
    pp.display_name,
    pp.is_kids_profile,
    p.early_access_features,
    pp.created_at,
    pp.updated_at
  FROM public.profiles_public pp
  JOIN public.profiles p ON pp.id = p.id
  WHERE p.user_id = auth.uid();
$function$;