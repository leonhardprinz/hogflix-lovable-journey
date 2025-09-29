-- Allow unauthenticated users to view videos for preview purposes
DROP POLICY IF EXISTS "Videos are viewable by authenticated users" ON public.videos;

-- Create new policy that allows public viewing of videos
CREATE POLICY "Videos are publicly viewable for previews" 
ON public.videos 
FOR SELECT 
USING (true);