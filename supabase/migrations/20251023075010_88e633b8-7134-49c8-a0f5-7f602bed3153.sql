-- Add early_access_features array to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS early_access_features TEXT[] DEFAULT '{}';

-- Add ai_summary column to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS ai_summary TEXT NULL;

-- Add RLS policy for users to update their own early access features
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can update their own early access features'
  ) THEN
    CREATE POLICY "Users can update their own early access features"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add RLS policy for admins to update ai_summary
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'videos' 
    AND policyname = 'Admins can update video summaries'
  ) THEN
    CREATE POLICY "Admins can update video summaries"
    ON videos FOR UPDATE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
  END IF;
END $$;