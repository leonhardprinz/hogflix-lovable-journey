-- Create a secure function to update early access features
CREATE OR REPLACE FUNCTION public.update_early_access_features(
  profile_id_param UUID,
  features_param TEXT[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile jsonb;
BEGIN
  -- Verify the user owns this profile
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = profile_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this profile';
  END IF;
  
  -- Update the features and return the updated row
  UPDATE public.profiles
  SET 
    early_access_features = features_param,
    updated_at = NOW()
  WHERE id = profile_id_param
  RETURNING jsonb_build_object(
    'id', id,
    'early_access_features', early_access_features,
    'updated_at', updated_at
  ) INTO updated_profile;
  
  IF updated_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  
  RETURN updated_profile;
END;
$$;