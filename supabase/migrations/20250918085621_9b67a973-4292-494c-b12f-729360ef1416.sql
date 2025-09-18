-- Create user_watchlist table for persistent "My List" functionality
CREATE TABLE public.user_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, profile_id, video_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own watchlist" 
ON public.user_watchlist 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own watchlist" 
ON public.user_watchlist 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own watchlist" 
ON public.user_watchlist 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to check if video is in user's watchlist
CREATE OR REPLACE FUNCTION public.is_video_in_watchlist(video_id_param uuid, profile_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_watchlist 
    WHERE video_id = video_id_param 
    AND profile_id = profile_id_param 
    AND user_id = auth.uid()
  );
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_watchlist_updated_at
BEFORE UPDATE ON public.user_watchlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();