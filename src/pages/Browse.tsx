import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { landmarkProps } from '../lib/demoErrors';
import { formatDuration } from '@/lib/formatDuration';
import { fetchVideoRatingsBatch } from '@/lib/fetchVideoRatings';
import Header from '@/components/Header';
import { HeroCarousel } from '@/components/HeroCarousel';
import { ResumeWatchingCarousel } from '@/components/ResumeWatchingCarousel';
import { PopularCarousel } from '@/components/PopularCarousel';
import { TrendingCarousel } from '@/components/TrendingCarousel';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { WatchlistButton } from '@/components/WatchlistButton';
import { Play, Info } from 'lucide-react';
import { HedgehogRating } from '@/components/HedgehogRating';
import { videoHrefFor } from '@/lib/videoRouting';
import { PowerUserBadge } from '@/components/PowerUserBadge';
import { slog, throwRateLimitError } from '@/lib/demoErrors';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  average_rating?: number;
  rating_count?: number;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
  videos: Video[];
}

const Browse = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile } = useProfile();

  // Power User Early Access feature flag
  // Enabled if: power_user_tier = "gold" or "platinum" AND videos_watched_external > 100
  const powerUserEarlyAccess = useFeatureFlagEnabled('power_user_early_access');




  // A/B test thumbnail function
  const getThumbnailUrl = (video: Video) => {
    // Get the feature flag variant for thumbnail experiment
    const variant = posthog.getFeatureFlag('thumbnail-experiment');

    // For testing purposes, we'll use the first video in the first category
    // In a real scenario, you'd have specific video IDs to test
    if (categories.length > 0 && categories[0].videos.length > 0 && video.id === categories[0].videos[0]?.id) {
      if (variant === 'test') {
        // Alternative thumbnail URL for A/B test
        return 'https://images.unsplash.com/photo-1489599807473-d2f3ba75b4c1?w=800&h=450&fit=crop&crop=center';
      }
    }

    // Return original thumbnail for control variant or other videos
    return video.thumbnail_url;
  };

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate('/login');
        return;
      }

      // Check if profile is selected
      if (!selectedProfile) {
        navigate('/profiles');
        return;
      }

      // Load feature flags before capturing events
      posthog.onFeatureFlags(() => {
        const sectionPriorityVariant = posthog.getFeatureFlag('Popular_vs_Trending_Priority_Algo_Test');

        // Fire PostHog analytics for page view with feature flag context
        posthog.capture('page:viewed_browse', {
          profile_id: selectedProfile.id,
          profile_name: selectedProfile.display_name || selectedProfile.email,
          section_priority_variant: sectionPriorityVariant || 'popular-first'
        });
      });

      // Fetch categories and videos
      await fetchCategoriesAndVideos();
    };

    checkAuthAndProfile();
  }, [navigate, selectedProfile, posthog]);

  const fetchCategoriesAndVideos = async () => {
    // --- Rate limit detection: fires if Browse is loaded 4+ times in 10s ---
    const now = Date.now();
    const windowMs = 10_000;
    const stored = sessionStorage.getItem('browse_load_timestamps');
    let timestamps: number[] = stored ? JSON.parse(stored) : [];
    timestamps = timestamps.filter(t => now - t < windowMs);
    timestamps.push(now);
    sessionStorage.setItem('browse_load_timestamps', JSON.stringify(timestamps));

    if (timestamps.length >= 4) {
      slog('API', 'warn', `⚠️ High request frequency detected — ${timestamps.length} requests in ${windowMs / 1000}s`);
      slog('API', 'error', `❌ Rate limit exceeded for /api/catalog/categories`);
      sessionStorage.removeItem('browse_load_timestamps'); // reset so it doesn't loop
      setTimeout(() => {
        try {
          throwRateLimitError('/api/catalog/categories', timestamps.length);
        } catch (err: any) {
          posthog.capture('$exception', {
            $exception_list: [
              {
                type: 'APIRateLimitError',
                value: err.message,
                mechanism: { handled: true, synthetic: false },
                stacktrace: {
                  type: 'raw' as const,
                  frames: [
                    { platform: 'web:javascript' as const, filename: 'src/pages/Browse.tsx', function: 'fetchCategories', lineno: 123, colno: 11, in_app: true },
                    { platform: 'web:javascript' as const, filename: 'src/lib/demoErrors.ts', function: 'validateAPIQuota', lineno: 161, colno: 9, in_app: true },
                    { platform: 'web:javascript' as const, filename: 'src/lib/demoErrors.ts', function: 'enforceRateLimit', lineno: 141, colno: 15, in_app: true },
                  ],
                },
              },
            ],
            $exception_message: err.message,
            $exception_type: 'APIRateLimitError',
            error_source: 'api_rate_limit',
            ...landmarkProps({
              statusCode: 429,
              apiUrl: 'https://api.hogflix.io/api/catalog/categories',
              screen: 'browseScreen',
            }),
          });
          throw err;
        }
      }, 100);
    }

    try {
      slog('API', 'info', `GET /api/catalog/categories — fetching...`);

      // Fetch categories ordered by sort_order
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (categoriesError) {
        slog('API', 'error', `GET /api/catalog/categories — ${categoriesError.message}`);
        console.error('Error fetching categories:', categoriesError);
        return;
      }

      slog('API', 'info', `GET /api/catalog/categories — 200 OK (${categoriesData.length} categories)`);

      // Fetch videos for each category (newest first, up to 20 per category)
      const categoriesWithVideos = await Promise.all(
        categoriesData.map(async (category) => {
          const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('category_id', category.id)
            .order('created_at', { ascending: false })
            .limit(20);

          if (videosError) {
            console.error(`Error fetching videos for category ${category.name}: `, videosError);
            return { ...category, videos: [] };
          }

          // Batch fetch ratings for all videos in this category
          const videoIds = (videos || []).map(v => v.id);
          const ratingsMap = await fetchVideoRatingsBatch(videoIds);

          const videosWithRatings = (videos || []).map((video) => {
            const ratings = ratingsMap.get(video.id) || { avg_rating: 0, rating_count: 0 };
            return {
              ...video,
              average_rating: ratings.avg_rating,
              rating_count: ratings.rating_count
            };
          });

          return { ...category, videos: videosWithRatings };
        })
      );

      // Only show categories with videos
      const categoriesWithContent = categoriesWithVideos.filter(category => category.videos.length > 0);

      // Prioritize PostHog Demo category to appear first
      const sortedCategories = categoriesWithContent.sort((a, b) => {
        if (a.name === 'PostHog Demo') return -1;
        if (b.name === 'PostHog Demo') return 1;
        return a.sort_order - b.sort_order;
      });

      setCategories(sortedCategories);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProfile || loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <Header />

      {/* Hero Section */}
      <HeroCarousel />

      {/* Content Carousels Container */}
      <div className="container-netflix py-12 space-y-12">
        {/* Power User Early Access Badge */}
        {powerUserEarlyAccess && (
          <PowerUserBadge className="mb-4" />
        )}

        {/* Profile Welcome Message */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-text-primary font-manrope">
            Welcome back, {selectedProfile.display_name || selectedProfile.email?.split('@')[0] || 'User'}
            {selectedProfile.is_kids_profile && (
              <span className="ml-2 bg-primary-red text-white text-sm px-2 py-1 rounded">KIDS</span>
            )}
          </h2>
        </div>

        {/* Resume Watching Section */}
        <ResumeWatchingCarousel />

        {/* Dynamic Sections - Order controlled by feature flag */}
        <DynamicSections posthog={posthog} selectedProfile={selectedProfile} />

        {/* Dynamic Categories and Videos */}
        <div className="space-y-16">
          {categories.map((category) => (
            <div key={category.id}>
              <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">
                {category.name}
              </h3>

              {/* Carousel with PostHog Tracking */}
              <Carousel
                className="w-full"
                categoryId={category.id}
                categoryName={category.name}
                opts={{
                  align: "start",
                  loop: false,
                }}
              >
                <CarouselContent className="-ml-4">
                  {category.videos.map((video) => (
                    <CarouselItem key={video.id} className="pl-4 basis-80">
                      <Link
                        to={videoHrefFor(category.name, video.id)}
                        data-ph-capture-attribute-video-id={video.id}
                      >
                        <div className="w-full bg-card-background rounded card-hover cursor-pointer group">
                          <div className="aspect-video bg-gray-700 rounded-t overflow-hidden relative">
                            <img
                              src={getThumbnailUrl(video)}
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
          ))}
        </div>
      </div>
    </div>
  );
};

// Component to handle dynamic section ordering based on feature flag
const DynamicSections = ({ posthog, selectedProfile }: { posthog: any; selectedProfile: any }) => {
  const [sectionPriorityVariant, setSectionPriorityVariant] = useState<string | null>(null);

  const flagLoadedRef = useRef(false);

  // Load feature flag and track section order impression (once only)
  useEffect(() => {
    if (flagLoadedRef.current) return;
    posthog.onFeatureFlags(() => {
      if (flagLoadedRef.current) return;
      flagLoadedRef.current = true;
      const variant = posthog.getFeatureFlag('Popular_vs_Trending_Priority_Algo_Test') as string || 'popular-first';
      setSectionPriorityVariant(variant);

      posthog.capture('feature_flag:section_priority_impression', {
        variant: variant,
        profile_id: selectedProfile?.id,
        timestamp: new Date().toISOString()
      });
    });
  }, [posthog, selectedProfile]);

  // Track section interactions
  const handleSectionView = (sectionName: string, position: number) => {
    posthog.capture('section:viewed', {
      section: sectionName.toLowerCase().includes('popular') ? 'popular' : 'trending',
      position: position,
      variant: sectionPriorityVariant || 'popular-first',
      profile_id: selectedProfile?.id,
      timestamp: new Date().toISOString()
    });
  };

  // Show ONLY Popular OR Trending based on feature flag (50/50 split)
  const sections = useMemo(() => {
    // Check if the variant contains 'trending' - show ONLY Trending
    if (sectionPriorityVariant && sectionPriorityVariant.includes('trending')) {
      return [
        { component: <TrendingCarousel key="trending" />, name: 'Trending Now', position: 1 }
      ];
    }

    // Default: show ONLY Popular (control)
    return [
      { component: <PopularCarousel key="popular" />, name: 'Popular on HogFlix', position: 1 }
    ];
  }, [sectionPriorityVariant]);

  return (
    <>
      {sections.map(({ component, name, position }) => (
        <div key={name} onMouseEnter={() => handleSectionView(name, position)}>
          {component}
        </div>
      ))}
    </>
  );
};

export default Browse;