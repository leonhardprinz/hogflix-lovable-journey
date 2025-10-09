-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_profiles INTEGER NOT NULL DEFAULT 1,
  video_quality TEXT NOT NULL DEFAULT 'HD',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on subscription_plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view plans
CREATE POLICY "Plans are viewable by everyone"
ON public.subscription_plans
FOR SELECT
USING (true);

-- Only admins can modify plans
CREATE POLICY "Admins can modify plans"
ON public.subscription_plans
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  payment_intent TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on user_subscriptions
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view their own subscription"
ON public.user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own subscription
CREATE POLICY "Users can create their own subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update subscriptions
CREATE POLICY "Admins can update subscriptions"
ON public.user_subscriptions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to get user subscription
CREATE OR REPLACE FUNCTION public.get_user_subscription(_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  subscription_id UUID,
  plan_id UUID,
  plan_name TEXT,
  plan_display_name TEXT,
  price_monthly NUMERIC,
  features JSONB,
  max_profiles INTEGER,
  video_quality TEXT,
  status TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    us.id,
    sp.id,
    sp.name,
    sp.display_name,
    sp.price_monthly,
    sp.features,
    sp.max_profiles,
    sp.video_quality,
    us.status,
    us.started_at,
    us.expires_at
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = _user_id
    AND us.status = 'active'
  LIMIT 1;
$$;

-- Create function to assign default subscription
CREATE OR REPLACE FUNCTION public.assign_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_plan_id UUID;
BEGIN
  -- Check if user already has a subscription
  IF NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.user_id
  ) THEN
    -- Get the default plan (Basic)
    SELECT id INTO default_plan_id
    FROM public.subscription_plans
    WHERE is_default = true
    LIMIT 1;
    
    -- Create subscription with default plan
    IF default_plan_id IS NOT NULL THEN
      INSERT INTO public.user_subscriptions (user_id, plan_id, status)
      VALUES (NEW.user_id, default_plan_id, 'active');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
CREATE TRIGGER assign_default_subscription_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_subscription();

-- Add update trigger for updated_at on subscription_plans
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add update trigger for updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, display_name, price_monthly, features, max_profiles, video_quality, is_default) VALUES
(
  'basic',
  'Basic',
  0.00,
  '["HD streaming quality", "1 profile", "Standard support", "Watch on any device", "Ad-supported content"]'::jsonb,
  1,
  'HD',
  true
),
(
  'standard',
  'Standard',
  9.99,
  '["Full HD streaming", "3 profiles", "Priority support", "Watch on any device", "Ad-free experience", "Download for offline viewing"]'::jsonb,
  3,
  'Full HD',
  false
),
(
  'premium',
  'Premium',
  19.99,
  '["4K + HDR quality", "5 profiles", "Priority support", "Watch on any device", "Ad-free experience", "Download for offline viewing", "Early access to new content", "FlixBuddy AI assistant"]'::jsonb,
  5,
  '4K + HDR',
  false
);