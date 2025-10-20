-- Update RLS policies for video tags and tag assignments
DROP POLICY IF EXISTS "Admins manage tags" ON video_tags;
DROP POLICY IF EXISTS "Everyone can view tags" ON video_tags;
DROP POLICY IF EXISTS "Admins manage tag assignments" ON video_tag_assignments;

-- Allow authenticated users to view tags
CREATE POLICY "Everyone can view tags" ON video_tags
FOR SELECT USING (true);

-- Allow admins/moderators to manage tags
CREATE POLICY "Admins manage tags" ON video_tags
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'moderator'::app_role)
);

-- Allow admins/moderators to manage video-tag assignments
CREATE POLICY "Admins manage tag assignments" ON video_tag_assignments
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'moderator'::app_role)
);

-- Create bulk update function for videos
CREATE OR REPLACE FUNCTION bulk_update_videos(
  video_ids UUID[],
  updates JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Check if user is admin/moderator
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Perform bulk update
  UPDATE videos
  SET 
    category_id = COALESCE((updates->>'category_id')::UUID, category_id),
    is_public = COALESCE((updates->>'is_public')::BOOLEAN, is_public),
    updated_at = NOW()
  WHERE id = ANY(video_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Log activity
  INSERT INTO admin_activity_log (admin_user_id, action_type, entity_type, details)
  VALUES (
    auth.uid(),
    'bulk_update',
    'video',
    jsonb_build_object(
      'video_ids', video_ids,
      'updated_count', updated_count,
      'changes', updates
    )
  );
  
  RETURN updated_count;
END;
$$;