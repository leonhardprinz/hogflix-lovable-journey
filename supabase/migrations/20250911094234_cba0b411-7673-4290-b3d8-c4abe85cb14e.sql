-- Storage policies for admin/moderator uploads
CREATE POLICY "Admins can upload to videos and thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('videos', 'video-thumbnails')
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Admins can update files in videos and thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('videos', 'video-thumbnails')
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
)
WITH CHECK (
  bucket_id IN ('videos', 'video-thumbnails')
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Admins can delete files in videos and thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('videos', 'video-thumbnails')
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);