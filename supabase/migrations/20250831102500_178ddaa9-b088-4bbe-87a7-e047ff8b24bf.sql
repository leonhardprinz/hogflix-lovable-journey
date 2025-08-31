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

-- Insert sample videos for each category
INSERT INTO public.videos (title, description, thumbnail_url, video_url, category_id, duration) 
SELECT 
  'Sample Video ' || series || ' - ' || title_suffix,
  'This is a sample description for ' || title_suffix || ' content.',
  'https://picsum.photos/400/225?random=' || (series * 10 + video_num),
  'https://sample-videos.com/zip/10/mp4/SampleVideo_' || video_num || '.mp4',
  cat.id,
  (1800 + (video_num * 300)) -- Duration between 30min to 3+ hours
FROM 
  (SELECT id, name, ROW_NUMBER() OVER (ORDER BY sort_order) as series FROM public.categories) cat
CROSS JOIN 
  (SELECT 
    num as video_num,
    CASE 
      WHEN cat_series = 1 THEN 'Continue Episode ' || num
      WHEN cat_series = 2 THEN 'Trending Title ' || num  
      WHEN cat_series = 3 THEN 'Popular Show ' || num
      WHEN cat_series = 4 THEN 'Action Movie ' || num
      WHEN cat_series = 5 THEN 'Comedy Special ' || num
      WHEN cat_series = 6 THEN 'Drama Series ' || num
      WHEN cat_series = 7 THEN 'Horror Film ' || num
      WHEN cat_series = 8 THEN 'Sci-Fi Adventure ' || num
      WHEN cat_series = 9 THEN 'Documentary ' || num
      ELSE 'Kids Show ' || num
    END as title_suffix
   FROM generate_series(1, 10) num, (SELECT cat.series as cat_series FROM (SELECT id, name, ROW_NUMBER() OVER (ORDER BY sort_order) as series FROM public.categories) cat) cat_info
  ) video_data
WHERE cat.series = video_data.cat_series;