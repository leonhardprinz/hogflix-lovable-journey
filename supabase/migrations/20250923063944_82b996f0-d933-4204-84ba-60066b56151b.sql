-- Add foreign key constraint from watch_progress to videos
ALTER TABLE public.watch_progress 
ADD CONSTRAINT fk_watch_progress_video 
FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate progress entries per user/profile/video
ALTER TABLE public.watch_progress 
ADD CONSTRAINT unique_user_profile_video 
UNIQUE (user_id, profile_id, video_id);