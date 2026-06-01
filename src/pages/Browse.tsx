import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostHog, useFeatureFlagVariantKey } from 'posthog-js/react';
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { WatchlistButton } from '@/components/WatchlistButton';
import { HedgehogRating } from '@/components/HedgehogRating';
import { videoHrefFor } from '@/lib/videoRouting';
import { PowerUserBadge } from '@/components/PowerUserBadge';
import { VipLivestreamBanner } from '@/components/VipLivestreamBanner';
import { slog, throwRateLimitError } from '@/lib/demoErrors';

// ─── A/B EXPERIMENT BANNER ─────────────────────────────────────────────
// IPL upgrade promo, gated by the `browse_upgrade_banner` experiment flag.
// `urgency_banner` variant shows the strip, `control` renders nothing.
// Fires three events: `$feature_flag_called` (exposure, once per page load),
// `browse_upgrade_banner:viewed` (when the strip actually paints), and
// `browse_upgrade_banner:clicked` (when the user follows the CTA).
// Dismissal is sticky for the session via sessionStorage.
const IplUpgradeBanner = () => {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const variant = useFeatureFlagVariantKey('browse_upgrade_banner') as string | undefined;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem('ipl_banner_dismissed') === 'true'; }
    catch { return false; }
  });
  const exposureSent = useRef(false);

  useEffect(() => {
    if (!variant || exposureSent.current) return;
    exposureSent.current = true;
    // Manual exposure: counts the user in the experiment at the moment the
    // variant is actually known on the rendered page. Critical for accurate
    // denominators on Razorpay's Segment-routed setup.
    posthog?.capture('$feature_flag_called', {
      $feature_flag: 'browse_upgrade_banner',
      $feature_flag_response: variant,
    });
    if (variant === 'urgency_banner' && !dismissed) {
      posthog?.capture('browse_upgrade_banner:viewed', { variant });
    }
  }, [variant, dismissed, posthog]);

  if (variant !== 'urgency_banner' || dismissed) return null;

  const handleClick = () => {
    posthog?.capture('browse_upgrade_banner:clicked', { variant });
    navigate('/pricing');
  };

  const handleDismiss = () => {
    try { sessionStorage.setItem('ipl_banner_dismissed', 'true'); } catch { /* no-op */ }
    setDismissed(true);
  };

  return (
    <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white shadow-lg">
      <div className="container-netflix flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 text-sm sm:text-base">
          <span className="text-xl">🏏</span>
          <span>
            <strong>IPL season is here</strong> &mdash; upgrade to Ultimate and stream live in 4K. Pay with UPI, card, or wallet.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleClick}
            className="bg-white text-red-700 font-semibold px-4 py-1.5 rounded-md hover:bg-red-50 transition whitespace-nowrap"
          >
            Upgrade now →
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white text-2xl leading-none px-2"
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── A/B EXPERIMENT BANNER #2 ───────────────────────────────────────────
// IPL Final tickets giveaway, gated by `browse_ipl_tickets_banner`.
// Sits below the hero so it coexists with the upgrade banner above it.
const IplTicketsBanner = () => {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const variant = useFeatureFlagVariantKey('browse_ipl_tickets_banner') as string | undefined;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem('ipl_tickets_banner_dismissed') === 'true'; }
    catch { return false; }
  });
  const exposureSent = useRef(false);

  useEffect(() => {
    if (!variant || exposureSent.current) return;
    exposureSent.current = true;
    posthog?.capture('$feature_flag_called', {
      $feature_flag: 'browse_ipl_tickets_banner',
      $feature_flag_response: variant,
    });
    if (variant === 'tickets_banner' && !dismissed) {
      posthog?.capture('browse_ipl_tickets_banner:viewed', { variant });
    }
  }, [variant, dismissed, posthog]);

  if (variant !== 'tickets_banner' || dismissed) return null;

  const handleClick = () => {
    posthog?.capture('browse_ipl_tickets_banner:clicked', { variant });
    navigate('/pricing');
  };

  const handleDismiss = () => {
    try { sessionStorage.setItem('ipl_tickets_banner_dismissed', 'true'); } catch { /* no-op */ }
    setDismissed(true);
  };

  return (
    <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 text-white shadow-lg">
      <div className="container-netflix flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 text-sm sm:text-base">
          <span className="text-xl">🎟️</span>
          <span>
            <strong>Open a HogFlix Premium account</strong> and enter the IPL Final tickets giveaway. KYC in 2 minutes, powered by Razorpay.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleClick}
            className="bg-white text-emerald-700 font-semibold px-4 py-1.5 rounded-md hover:bg-emerald-50 transition whitespace-nowrap"
          >
            Open Premium account →
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white text-2xl leading-none px-2"
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

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

  // VIP Livestream Banner feature flag
  const vipLivestreamBanner = useFeatureFlagEnabled('vip_livestream_banner');




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

      posthog.capture('page:viewed_browse', {
        profile_id: selectedProfile.id,
        profile_name: selectedProfile.display_name || selectedProfile.email,
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

      {/* A/B experiment: IPL upgrade promo banner (browse_upgrade_banner flag) */}
      <IplUpgradeBanner />

      {/* Hero Section */}
      <HeroCarousel />

      {/* A/B experiment: IPL Final tickets giveaway (browse_ipl_tickets_banner flag) */}
      <IplTicketsBanner />

      {/* Content Carousels Container */}
      <div className="container-netflix py-12 space-y-12">
        {/* VIP Livestream Banner */}
        {vipLivestreamBanner && (
          <VipLivestreamBanner className="mb-4" />
        )}

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

        <PopularCarousel />

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
          ))}
        </div>
      </div>
    </div>
  );
};

export default Browse;