-- Create video_ratings table for persistent hedgehog ratings
CREATE TABLE public.video_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, profile_id)
);

-- Enable RLS on video_ratings
ALTER TABLE public.video_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_ratings
CREATE POLICY "Users can view all ratings" 
ON public.video_ratings 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own ratings" 
ON public.video_ratings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" 
ON public.video_ratings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to get average rating for a video
CREATE OR REPLACE FUNCTION public.get_video_average_rating(video_id_param UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT COALESCE(AVG(rating::NUMERIC), 0)
    FROM public.video_ratings 
    WHERE video_id = video_id_param
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function to get rating count for a video
CREATE OR REPLACE FUNCTION public.get_video_rating_count(video_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.video_ratings 
    WHERE video_id = video_id_param
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function to get user's rating for a video
CREATE OR REPLACE FUNCTION public.get_user_video_rating(video_id_param UUID, profile_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT rating
    FROM public.video_ratings 
    WHERE video_id = video_id_param AND profile_id = profile_id_param
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_video_ratings_updated_at
BEFORE UPDATE ON public.video_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();