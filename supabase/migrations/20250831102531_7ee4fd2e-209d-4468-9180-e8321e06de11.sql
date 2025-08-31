-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL DEFAULT 0, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create policies for categories (readable by all authenticated users)
CREATE POLICY "Categories are viewable by authenticated users" 
ON public.categories 
FOR SELECT 
TO authenticated
USING (true);

-- Create policies for videos (readable by all authenticated users)
CREATE POLICY "Videos are viewable by authenticated users" 
ON public.videos 
FOR SELECT 
TO authenticated
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_categories_sort_order ON public.categories(sort_order);
CREATE INDEX idx_videos_category_id ON public.videos(category_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample categories
INSERT INTO public.categories (name, sort_order) VALUES
('Continue Watching', 1),
('Trending Now', 2),
('Popular on HogFlix', 3),
('Action & Adventure', 4),
('Comedy', 5),
('Drama', 6),
('Horror', 7),
('Sci-Fi', 8),
('Documentary', 9),
('Kids & Family', 10);

-- Insert sample videos (we'll do this in a simpler way)
WITH category_ids AS (
  SELECT id, name, sort_order FROM public.categories ORDER BY sort_order
)
INSERT INTO public.videos (title, description, thumbnail_url, video_url, category_id, duration)
SELECT 
  cat.name || ' Content ' || series.num,
  'Sample description for ' || cat.name || ' content number ' || series.num,
  'https://picsum.photos/400/225?random=' || (cat.sort_order * 10 + series.num),
  'https://sample-video-url.com/video' || (cat.sort_order * 10 + series.num) || '.mp4',
  cat.id,
  (1800 + (series.num * 300))
FROM category_ids cat
CROSS JOIN generate_series(1, 10) AS series(num);