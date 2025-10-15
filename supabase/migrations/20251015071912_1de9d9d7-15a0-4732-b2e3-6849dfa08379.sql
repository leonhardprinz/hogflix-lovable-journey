-- Add marketing_opt_in column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.marketing_opt_in IS 'User consent for marketing emails and newsletters via PostHog campaigns';