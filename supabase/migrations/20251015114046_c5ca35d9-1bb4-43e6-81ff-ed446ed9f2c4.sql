-- Add newsletter-related columns to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS published_at timestamptz DEFAULT now();

-- Populate published_at with created_at for existing videos
UPDATE videos 
SET published_at = created_at 
WHERE published_at IS NULL;

-- Populate is_public as true for existing videos
UPDATE videos 
SET is_public = true 
WHERE is_public IS NULL;

-- Generate slugs for existing videos from their titles
UPDATE videos
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Handle duplicate slugs by appending a number
DO $$
DECLARE
  vid RECORD;
  new_slug TEXT;
  counter INT;
BEGIN
  FOR vid IN 
    SELECT id, slug 
    FROM videos 
    WHERE slug IN (
      SELECT slug 
      FROM videos 
      WHERE slug IS NOT NULL 
      GROUP BY slug 
      HAVING COUNT(*) > 1
    )
    ORDER BY created_at
  LOOP
    counter := 1;
    new_slug := vid.slug || '-' || counter;
    
    WHILE EXISTS (SELECT 1 FROM videos WHERE slug = new_slug) LOOP
      counter := counter + 1;
      new_slug := vid.slug || '-' || counter;
    END LOOP;
    
    UPDATE videos SET slug = new_slug WHERE id = vid.id;
  END LOOP;
END $$;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS videos_slug_idx ON videos (slug);

-- Create index for faster queries on published_at
CREATE INDEX IF NOT EXISTS videos_published_at_idx ON videos (published_at DESC);

-- Create index for filtering by is_public
CREATE INDEX IF NOT EXISTS videos_is_public_idx ON videos (is_public) WHERE is_public = true;

-- Add comments to explain the columns
COMMENT ON COLUMN videos.slug IS 'URL-friendly version of the title for clean links in newsletters';
COMMENT ON COLUMN videos.is_public IS 'Whether the video should be shown in newsletters and public listings';
COMMENT ON COLUMN videos.published_at IS 'When the video was published (defaults to created_at for existing videos)';