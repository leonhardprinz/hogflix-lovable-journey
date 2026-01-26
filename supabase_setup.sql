-- =====================================================
-- HogFlix Database Setup Script
-- Run this in Supabase SQL Editor to set up the database
-- =====================================================

-- 1. Create update_updated_at function (needed for triggers)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_kids_profile BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles" ON public.profiles 
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles" ON public.profiles 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles" ON public.profiles 
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 3. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by authenticated users" 
  ON public.categories FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- 4. Create videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Videos are viewable by authenticated users" 
  ON public.videos FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_videos_category_id ON public.videos(category_id);

-- 5. Create user_watchlist table
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watchlist" ON public.user_watchlist 
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 6. Create watch_progress table
CREATE TABLE IF NOT EXISTS public.watch_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  progress_percentage NUMERIC(5,2) DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watch progress" ON public.watch_progress 
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 7. Insert sample categories
INSERT INTO public.categories (name, sort_order) VALUES
('Popular on HogFlix', 1),
('Trending Now', 2),
('Action & Adventure', 3),
('Comedy', 4),
('Drama', 5),
('Sci-Fi', 6),
('Documentary', 7),
('Kids & Family', 8)
ON CONFLICT DO NOTHING;

-- 8. Insert sample videos with Hog-themed titles
INSERT INTO public.videos (title, description, thumbnail_url, video_url, category_id, duration)
SELECT 
  title,
  description,
  'https://picsum.photos/400/225?random=' || row_num,
  'https://sample-videos.com/video' || row_num || '.mp4',
  cat.id,
  duration
FROM public.categories cat
CROSS JOIN (
  VALUES 
    (1, 'AvengerHogs Endgame', 'Earth''s mightiest hogs assemble for the ultimate battle.', 9240),
    (2, 'Hog Potter and the Sorcerer''s Shrub', 'A young hog discovers he has magical powers.', 9120),
    (3, 'Lord of the Hogs', 'An epic journey across Middle Meadow.', 10800),
    (4, 'Star Hog Wars', 'A long time ago in a barn far, far away...', 7800),
    (5, 'The Martian Hog', 'A hog stranded on Mars must survive.', 8640),
    (6, 'Jurassic Hog', 'Ancient creatures brought back to life.', 7560),
    (7, 'Hog Hard', 'One hog against impossible odds.', 7920),
    (8, 'The Hog Knight', 'A hero rises in Gotham Barn.', 9000),
    (9, 'Forrest Hog', 'Life is like a box of truffles.', 8280),
    (10, 'The Hoggfather', 'An offer you can''t refuse.', 10500)
) AS video_data(row_num, title, description, duration)
WHERE cat.sort_order = 1
ON CONFLICT DO NOTHING;

-- Add more videos for other categories
INSERT INTO public.videos (title, description, thumbnail_url, video_url, category_id, duration)
SELECT 
  cat.name || ' Feature ' || series.num,
  'An amazing ' || cat.name || ' production featuring the best hog talent.',
  'https://picsum.photos/400/225?random=' || (cat.sort_order * 100 + series.num),
  'https://sample-videos.com/video' || (cat.sort_order * 100 + series.num) || '.mp4',
  cat.id,
  (5400 + (series.num * 600))
FROM public.categories cat
CROSS JOIN generate_series(1, 8) AS series(num)
WHERE cat.sort_order > 1
ON CONFLICT DO NOTHING;

-- Done!
SELECT 'Database setup complete! ' || COUNT(*) || ' videos created.' as result FROM public.videos;
