import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { WatchlistButton } from '@/components/WatchlistButton';
import { HedgehogRating } from '@/components/HedgehogRating';
import { Skeleton } from '@/components/ui/skeleton';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  average_rating: number;
  rating_count: number;
  trending_score: number;
}

export const TrendingCarousel = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const posthog = usePostHog();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchTrendingVideos();
  }, []);

  const handleVideoClick = (video: Video, position: number) => {
    const sectionPriorityVariant = posthog.getFeatureFlag('section-priority-test');
    posthog.capture('trending_section:video_clicked', {
      video_id: video.id,
      video_title: video.title,
      position_in_carousel: position,
      trending_score: video.trending_score,
      section_priority_variant: sectionPriorityVariant || 'popular-first',
      timestamp: new Date().toISOString()
    });
  };

  const fetchTrendingVideos = async () => {
    try {
      // Get videos from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: videosData, error } = await supabase
        .from('videos')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching trending videos:', error);
        return;
      }

      // Add rating data and calculate trending score
      const videosWithTrending = await Promise.all(
        (videosData || []).map(async (video) => {
          try {
            const { data: avgRating } = await supabase.rpc('get_video_average_rating', { video_id_param: video.id });
            const { data: ratingCount } = await supabase.rpc('get_video_rating_count', { video_id_param: video.id });
            
            const averageRating = avgRating || 0;
            const totalRatings = ratingCount || 0;
            
            // Trending algorithm: emphasize recent engagement
            const daysOld = Math.max(1, Math.floor((Date.now() - new Date(video.created_at).getTime()) / (1000 * 60 * 60 * 24)));
            const recencyWeight = Math.max(0.1, (30 - daysOld) / 30); // Higher weight for newer content
            const engagementScore = averageRating * Math.sqrt(totalRatings + 1);
            const trendingScore = engagementScore * recencyWeight * 10;
            
            return {
              ...video,
              average_rating: averageRating,
              rating_count: totalRatings,
              trending_score: trendingScore
            };
          } catch (error) {
            console.error(`Error calculating trending score for video ${video.id}:`, error);
            return { 
              ...video, 
              average_rating: 0, 
              rating_count: 0,
              trending_score: 0
            };
          }
        })
      );

      // Sort by trending score and take top 20
      const trendingVideos = videosWithTrending
        .sort((a, b) => b.trending_score - a.trending_score)
        .slice(0, 20);

      setVideos(trendingVideos);
    } catch (error) {
      console.error('Error fetching trending videos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">
          Trending Now
        </h3>
        <div className="flex space-x-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-80 h-48 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">
        Trending Now
      </h3>
      
      <Carousel 
        className="w-full"
        categoryId="trending"
        categoryName="Trending Now"
        opts={{
          align: "start",
          loop: false,
        }}
      >
        <CarouselContent className="-ml-4">
          {videos.map((video, index) => (
            <CarouselItem key={video.id} className="pl-4 basis-80">
              <Link
                to={`/watch/${video.id}`}
                onClick={() => handleVideoClick(video, index + 1)}
                data-ph-capture-attribute-video-id={video.id}
              >
                <div className="w-full bg-card-background rounded card-hover cursor-pointer group">
                  <div className="aspect-video bg-gray-700 rounded-t overflow-hidden relative">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                    {/* Watchlist button overlay */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <WatchlistButton
                        videoId={video.id}
                        variant="icon"
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="text-text-primary font-manrope font-medium mb-2 truncate">
                      {video.title}
                    </h4>
                    <div className="flex items-center justify-between">
                      <p className="text-text-tertiary text-sm font-manrope">
                        {formatDuration(video.duration)}
                      </p>
                      <div className="ml-2">
                        <HedgehogRating
                          videoId={video.id}
                          averageRating={video.average_rating}
                          totalRatings={video.rating_count}
                          size="small"
                          showStats={false}
                          readOnly={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
    </div>
  );
};