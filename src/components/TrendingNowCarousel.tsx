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
import { videoHrefFor } from '@/lib/videoRouting';
import { formatDuration } from '@/lib/formatDuration';
import { fetchVideoRatingsBatch } from '@/lib/fetchVideoRatings';
import { useTrendingContent } from '@/hooks/useTrendingContent';

/**
 * "Trending this week" row (endpoint-driven; distinct from the legacy TrendingCarousel). The ranking comes live from the PostHog `trending_content`
 * endpoint (top titles by real play counts), fetched via /api/trending. We then load those
 * exact videos from Supabase and render them in the PostHog-ranked order — product data
 * powering a product feature.
 */
interface TrendingVideo {
  id: string;
  title: string;
  thumbnail_url: string;
  duration: number;
  plays: number;
  unique_viewers: number;
  average_rating: number;
  rating_count: number;
  categories?: { name: string };
}

export const TrendingNowCarousel = () => {
  const { data: trending, isLoading: trendingLoading } = useTrendingContent(30, 10);
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const posthog = usePostHog();

  useEffect(() => {
    const loadVideos = async () => {
      if (!trending) return; // still loading
      if (trending.length === 0) {
        setVideos([]);
        setLoadingVideos(false);
        return;
      }
      try {
        const ids = trending.map((t) => t.content_id);
        const { data: videosData, error } = await supabase
          .from('videos')
          .select(`
            *,
            categories!videos_category_id_fkey!inner (
              name
            )
          `)
          .in('id', ids);

        if (error) {
          console.error('Error fetching trending videos:', error);
          setLoadingVideos(false);
          return;
        }

        const ratingsMap = await fetchVideoRatingsBatch((videosData || []).map((v) => v.id));
        const byId = new Map((videosData || []).map((v) => [v.id, v]));

        // Preserve the PostHog ranking; attach play counts and ratings. Drop any content_id
        // that no longer exists as a video in Supabase.
        const ordered = trending
          .map((t) => {
            const video = byId.get(t.content_id);
            if (!video) return null;
            const ratings = ratingsMap.get(video.id) || { avg_rating: 0, rating_count: 0 };
            return {
              ...video,
              plays: t.plays,
              unique_viewers: t.unique_viewers,
              average_rating: ratings.avg_rating,
              rating_count: ratings.rating_count,
            } as TrendingVideo;
          })
          .filter((v): v is TrendingVideo => v !== null);

        setVideos(ordered);
      } catch (e) {
        console.error('Error building trending carousel:', e);
      } finally {
        setLoadingVideos(false);
      }
    };

    loadVideos();
  }, [trending]);

  const handleVideoClick = (video: TrendingVideo, position: number) => {
    sessionStorage.setItem('video_source_section', 'trending');
    posthog.capture('section:clicked', {
      section: 'trending',
      video_id: video.id,
      video_title: video.title,
      position_in_carousel: position,
      plays: video.plays,
      timestamp: new Date().toISOString(),
    });
  };

  if (trendingLoading || loadingVideos) {
    return (
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">
          Trending this week
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
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-xl font-bold text-text-primary font-manrope">Trending this week</h3>
        <span className="text-[11px] uppercase tracking-wide text-text-tertiary bg-white/5 border border-white/10 rounded px-2 py-0.5">
          Ranked live by PostHog
        </span>
      </div>

      <Carousel
        className="w-full"
        categoryId="trending"
        categoryName="Trending this week"
        opts={{
          align: 'start',
          loop: false,
        }}
      >
        <CarouselContent className="-ml-4">
          {videos.map((video, index) => (
            <CarouselItem key={video.id} className="pl-4 basis-80">
              <Link
                to={videoHrefFor(video.categories?.name, video.id)}
                onClick={() => handleVideoClick(video, index + 1)}
                data-ph-capture-attribute-video-id={video.id}
              >
                <div className="w-full bg-card-background rounded card-hover cursor-pointer group">
                  <div className="aspect-video bg-gray-700 rounded-t overflow-hidden relative">
                    {/* Rank badge — position is driven by PostHog play data */}
                    <div className="absolute top-2 left-2 z-10 bg-primary-red text-white text-xs font-bold px-2 py-1 rounded shadow">
                      #{index + 1}
                    </div>
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                    {/* Watchlist button overlay */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <WatchlistButton videoId={video.id} variant="icon" size="sm" />
                    </div>
                    {/* Play-count badge from the endpoint */}
                    <div className="absolute bottom-2 left-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-medium">
                      ▶ {video.plays.toLocaleString()} plays
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
