-- Make videos bucket private for secure access
UPDATE storage.buckets 
SET public = false 
WHERE id = 'videos';

-- If the videos bucket doesn't exist, create it as private
INSERT INTO storage.buckets (id, name, public) 
SELECT 'videos', 'videos', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'videos');