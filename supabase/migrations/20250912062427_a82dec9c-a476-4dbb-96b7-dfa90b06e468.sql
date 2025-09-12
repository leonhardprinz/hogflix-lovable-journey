-- Allow all authenticated users to insert videos
CREATE POLICY "Authenticated users can insert videos"
ON public.videos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to insert categories  
CREATE POLICY "Authenticated users can insert categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update storage policies to allow all authenticated users to upload
DROP POLICY IF EXISTS "Admins can upload to videos and thumbnails" ON storage.objects;

CREATE POLICY "Authenticated users can upload to videos and thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('videos', 'video-thumbnails'));

-- Update storage policies for updating files
DROP POLICY IF EXISTS "Admins can update files in videos and thumbnails" ON storage.objects;

CREATE POLICY "Authenticated users can update files in videos and thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id IN ('videos', 'video-thumbnails'))
WITH CHECK (bucket_id IN ('videos', 'video-thumbnails'));

-- Update storage policies for deleting files (keep admin-only for moderation)
DROP POLICY IF EXISTS "Admins can delete files in videos and thumbnails" ON storage.objects;

CREATE POLICY "Admins can delete files in videos and thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('videos', 'video-thumbnails')
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);