-- Drop the incorrectly configured policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate with correct role (authenticated instead of public)
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);