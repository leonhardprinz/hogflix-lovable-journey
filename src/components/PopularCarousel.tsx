import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  popularity_score: number;
}

export const PopularCarousel = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetchPopularVideos();
  }, []);

  const fetchPopularVideos = async () => {
    try {
      const { data: videosData, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching videos:', error);
        return;
      }

      // Add rating data and calculate popularity score
      const videosWithPopularity = await Promise.all(
        (videosData || []).map(async (video) => {
          try {
            const { data: avgRating } = await supabase.rpc('get_video_average_rating', { video_id_param: video.id });
            const { data: ratingCount } = await supabase.rpc('get_video_rating_count', { video_id_param: video.id });
            
            const averageRating = avgRating || 0;
            const totalRatings = ratingCount || 0;
            
            // Popularity algorithm: weighted rating + rating count + recency boost
            const daysOld = Math.max(1, Math.floor((Date.now() - new Date(video.created_at).getTime()) / (1000 * 60 * 60 * 24)));
            const recencyBoost = Math.max(0, (30 - daysOld) / 30); // Boost for videos less than 30 days old
            const popularityScore = (averageRating * Math.log(totalRatings + 1)) + (recencyBoost * 2);
            
            return {
              ...video,
              average_rating: averageRating,
              rating_count: totalRatings,
              popularity_score: popularityScore
            };
          } catch (error) {
            console.error(`Error calculating popularity for video ${video.id}:`, error);
            return { 
              ...video, 
              average_rating: 0, 
              rating_count: 0,
              popularity_score: 0
            };
          }
        })
      );

      // Sort by popularity score and take top 20
      const popularVideos = videosWithPopularity
        .sort((a, b) => b.popularity_score - a.popularity_score)
        .slice(0, 20);

      setVideos(popularVideos);
    } catch (error) {
      console.error('Error fetching popular videos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">
          Popular on HogFlix
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
        Popular on HogFlix
      </h3>
      
      <Carousel 
        className="w-full"
        categoryId="popular"
        categoryName="Popular on HogFlix"
        opts={{
          align: "start",
          loop: false,
        }}
      >
        <CarouselContent className="-ml-4">
          {videos.map((video) => (
            <CarouselItem key={video.id} className="pl-4 basis-80">
              <Link
                to={`/watch/${video.id}`}
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