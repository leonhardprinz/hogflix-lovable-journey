-- Create watch_progress table for resume watching functionality
CREATE TABLE public.watch_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  video_id uuid NOT NULL,
  progress_seconds integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  progress_percentage numeric NOT NULL DEFAULT 0,
  last_watched_at timestamp with time zone NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  session_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure one progress record per user/profile/video combination
  UNIQUE(user_id, profile_id, video_id)
);

-- Enable Row Level Security
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own watch progress" 
ON public.watch_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own watch progress" 
ON public.watch_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch progress" 
ON public.watch_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch progress" 
ON public.watch_progress 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_watch_progress_user_profile ON public.watch_progress(user_id, profile_id);
CREATE INDEX idx_watch_progress_last_watched ON public.watch_progress(last_watched_at DESC);

-- Create function to update timestamps
CREATE TRIGGER update_watch_progress_updated_at
BEFORE UPDATE ON public.watch_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();