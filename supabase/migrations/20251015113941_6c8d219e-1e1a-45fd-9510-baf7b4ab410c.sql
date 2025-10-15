-- Fix the profiles SELECT policy to work with authenticated users
-- Drop the incorrectly configured policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate with correct role specification
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated  -- Critical: specifies this policy applies to logged-in users
USING (auth.uid() = user_id);

-- Verify all other policies are also using authenticated role
-- Drop and recreate INSERT policy with explicit role
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate UPDATE policy with explicit role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);