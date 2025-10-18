import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { usePostHog } from 'posthog-js/react';
import { videoHrefFor } from '@/lib/videoRouting';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  categories?: { name: string };
}

export const HeroCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const posthog = usePostHog();

  useEffect(() => {
    fetchFeaturedVideos();
  }, []);

  useEffect(() => {
    if (isAutoPlaying && slides.length > 0) {
      startAutoPlay();
    }
    return () => clearAutoPlay();
  }, [isAutoPlaying, slides, currentSlide]);

  const fetchFeaturedVideos = async () => {
    try {
      const { data: videos, error } = await supabase
        .from('videos')
        .select(`
          id, title, description, thumbnail_url, video_url, duration,
          categories!inner (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (videos && videos.length > 0) {
        setSlides(videos);
        posthog?.capture('hero_carousel:viewed', {
          video_count: videos.length
        });
      }
    } catch (error) {
      console.error('Error fetching featured videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const startAutoPlay = () => {
    clearAutoPlay();
    intervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
  };

  const clearAutoPlay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetAutoPlay = () => {
    clearAutoPlay();
    if (isAutoPlaying) {
      startAutoPlay();
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    posthog?.capture('hero_carousel:dot_clicked', {
      slide_index: index,
      video_id: slides[index]?.id
    });
    resetAutoPlay();
  };

  const nextSlide = () => {
    const nextIndex = (currentSlide + 1) % slides.length;
    setCurrentSlide(nextIndex);
    posthog?.capture('hero_carousel:next_clicked', {
      slide_index: nextIndex,
      video_id: slides[nextIndex]?.id
    });
    resetAutoPlay();
  };

  const prevSlide = () => {
    const prevIndex = (currentSlide - 1 + slides.length) % slides.length;
    setCurrentSlide(prevIndex);
    posthog?.capture('hero_carousel:prev_clicked', {
      slide_index: prevIndex,
      video_id: slides[prevIndex]?.id
    });
    resetAutoPlay();
  };

  const handleMouseEnter = () => {
    setIsAutoPlaying(false);
    clearAutoPlay();
  };

  const handleMouseLeave = () => {
    setIsAutoPlaying(true);
  };

  const handleWatchNowClick = (videoId: string) => {
    posthog?.capture('hero_carousel:watch_now_clicked', {
      video_id: videoId,
      slide_index: currentSlide
    });
  };

  if (loading || slides.length === 0) {
    return (
      <div className="carousel-container w-full bg-gradient-to-b from-background/50 to-background animate-pulse" />
    );
  }

  return (
    <div
      className="carousel-container relative w-full overflow-hidden shadow-2xl rounded-lg md:rounded-xl mx-auto max-w-screen-2xl mt-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured videos"
    >
      {/* Slides Container */}
      <div
        className="carousel-slide-transition flex h-full w-full"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((video, index) => (
          <div
            key={video.id}
            className="min-w-full h-full relative carousel-gradient-overlay"
            style={{
              backgroundImage: `url(${video.thumbnail_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            aria-label={`Slide ${index + 1}: ${video.title}`}
            aria-hidden={index !== currentSlide}
          >
            <div className="absolute bottom-0 left-0 p-6 md:p-12 z-10 max-w-3xl">
              <h1 className="text-2xl md:text-5xl font-black mb-2 md:mb-4 text-white drop-shadow-lg">
                {video.title}
              </h1>
              {video.description && (
                <p className="text-sm md:text-lg mb-4 md:mb-6 text-white/90 drop-shadow-md line-clamp-2 md:line-clamp-3">
                  {video.description}
                </p>
              )}
              <Link to={videoHrefFor((video as any)?.categories?.name, video.id)} onClick={() => handleWatchNowClick(video.id)}>
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all duration-300 shadow-lg"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Watch Now
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevSlide}
          className="bg-black/50 hover:bg-black/75 rounded-full transition-all pointer-events-auto"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextSlide}
          className="bg-black/50 hover:bg-black/75 rounded-full transition-all pointer-events-auto"
          aria-label="Next slide"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Pagination Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-3 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`carousel-dot-transition w-3 h-3 rounded-full ${
              index === currentSlide
                ? 'bg-white scale-125'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentSlide ? 'true' : 'false'}
          />
        ))}
      </div>
    </div>
  );
};
