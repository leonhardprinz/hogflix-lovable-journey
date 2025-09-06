-- Enums
DO $$ BEGIN
  CREATE TYPE public.asset_type AS ENUM ('original','hls','trailer','preview');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table: video_assets (multiple encodings or asset types per video)
CREATE TABLE IF NOT EXISTS public.video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  asset_type public.asset_type NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'videos',
  path TEXT NOT NULL,
  codec TEXT,
  width INTEGER,
  height INTEGER,
  bitrate INTEGER,
  duration INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read assets
CREATE POLICY "Video assets are viewable by authenticated users"
ON public.video_assets
FOR SELECT
TO authenticated
USING (true);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_video_assets_updated_at
BEFORE UPDATE ON public.video_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_video_assets_video_id ON public.video_assets(video_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_type ON public.video_assets(asset_type);

-- Table: subtitles (caption files per video)
CREATE TABLE IF NOT EXISTS public.subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,            -- e.g., 'en', 'es-419'
  label TEXT,                             -- e.g., 'English', 'Spanish (LATAM)'
  storage_bucket TEXT NOT NULL DEFAULT 'videos',
  path TEXT NOT NULL,                     -- storage path to .vtt/.srt
  format TEXT NOT NULL DEFAULT 'vtt',     -- 'vtt' | 'srt'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subtitles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read subtitles
CREATE POLICY "Subtitles are viewable by authenticated users"
ON public.subtitles
FOR SELECT
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_subtitles_updated_at
BEFORE UPDATE ON public.subtitles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_subtitles_video_id ON public.subtitles(video_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_lang ON public.subtitles(language_code);

-- Table: video_categories (many-to-many between videos and categories)
CREATE TABLE IF NOT EXISTS public.video_categories (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, category_id)
);

ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read relationships
CREATE POLICY "Video-category links are viewable by authenticated users"
ON public.video_categories
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_video_categories_video_id ON public.video_categories(video_id);
CREATE INDEX IF NOT EXISTS idx_video_categories_category_id ON public.video_categories(category_id);