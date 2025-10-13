import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { useAnimateOnce } from '@/hooks/useAnimateOnce';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import ContentPreviewCarousel from '@/components/ContentPreviewCarousel';
import { Play, Star, Users, BarChart3, Eye, Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { selectedProfile } = useProfile();
  const hasAnimated = useAnimateOnce(100);
  const isMobile = useIsMobile();
  const [featuredVideo, setFeaturedVideo] = useState<any>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // Fetch featured video for background with signed URL
  useEffect(() => {
    const fetchFeaturedVideo = async () => {
      try {
        // Fetch video metadata (prefer shorter videos for backgrounds)
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('*')
          .order('created_at', { ascending: false })
          .lte('duration', 60) // Prefer videos under 60 seconds
          .limit(1)
          .single();
        
        if (videoError || !videoData) {
          console.log('No suitable video found for background');
          setVideoLoading(false);
          return;
        }

        // Get signed URL from edge function
        const { data: urlData, error: urlError } = await supabase.functions.invoke('get-video-url', {
          body: { videoId: videoData.id }
        });

        if (urlError || !urlData?.signedUrl) {
          console.error('Failed to get signed URL:', urlError);
          setVideoError(true);
          setVideoLoading(false);
          return;
        }

        console.log('✅ Got signed video URL for background');
        setFeaturedVideo({
          ...videoData,
          signedVideoUrl: urlData.signedUrl
        });
      } catch (error) {
        console.error('Error fetching featured video:', error);
        setVideoError(true);
        setVideoLoading(false);
      }
    };

    fetchFeaturedVideo();
  }, []);

  // Auth check and redirect effect
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Use a longer delay to ensure profile context is loaded
        setTimeout(() => {
          if (selectedProfile) {
            navigate('/browse');
          } else {
            navigate('/profiles');
          }
        }, 200);
      }
    };

    checkAuthAndRedirect();
  }, [navigate]); // Remove selectedProfile dependency

  return (
    <div className="min-h-screen bg-background-dark">
      {/* Hero Section - Compact */}
      <div className="relative min-h-[60vh] lg:min-h-[70vh] overflow-hidden pt-12 pb-16">
        {/* Background Video */}
        {featuredVideo?.signedVideoUrl && !videoError && (
          <>
            <video
              autoPlay={!isMobile}
              muted
              loop
              playsInline
              preload={isMobile ? "metadata" : "auto"}
              poster={featuredVideo.thumbnail_url}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              onLoadedData={() => {
                setVideoLoading(false);
                console.log('✅ Background video loaded successfully');
              }}
              onError={(e) => {
                console.error('❌ Background video error:', e);
                setVideoError(true);
                setVideoLoading(false);
              }}
              onCanPlay={() => console.log('▶️ Video can play')}
            >
              <source src={featuredVideo.signedVideoUrl} type="video/mp4" />
            </video>
            {/* Gradient Overlays for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-background-dark via-background-dark/90 to-background-dark/70" />
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-transparent to-transparent" />
          </>
        )}
        
        {/* Fallback Gradient */}
        {(!featuredVideo?.signedVideoUrl || videoError) && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-red/20 via-background-dark to-background-dark">
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, #e50914 0%, transparent 50%),
                                  radial-gradient(circle at 75% 75%, #221f1f 0%, transparent 50%)`,
              }}
            />
          </div>
        )}
        
        {/* Hero Content */}
        <div className="relative container-netflix flex flex-col justify-center items-center text-center px-4 z-10">
          <div className="max-w-4xl w-full">
            {/* Logo */}
            <h1 className={`text-4xl sm:text-5xl lg:text-7xl font-bold text-primary-red mb-3 sm:mb-4 font-manrope ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}>
              HogFlix
            </h1>
            
            {/* Main Headline */}
            <h2 className={`text-xl sm:text-3xl lg:text-5xl font-bold text-text-primary mb-4 sm:mb-6 font-manrope leading-tight px-2 ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: hasAnimated ? '0.2s' : '0' }}>
              Unlimited movies, TV shows, and more
            </h2>
            
            {/* Subheadline */}
            <p className={`text-base sm:text-lg lg:text-xl text-text-secondary mb-6 sm:mb-8 font-manrope max-w-2xl mx-auto px-4 ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: hasAnimated ? '0.4s' : '0' }}>
              From hedgehog adventures to PostHog demos - discover content that entertains and educates.
            </p>
            
            {/* CTA Buttons - Sign Up Free FIRST */}
            <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-8 ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: hasAnimated ? '0.6s' : '0' }}>
              <Link to="/signup" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg sm:text-xl px-10 sm:px-16 py-4 sm:py-6 font-bold shadow-lg shadow-primary/30 transition-all hover:scale-105">
                  Sign Up Free
                </Button>
              </Link>
              <Link to="/pricing" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto text-lg sm:text-xl px-10 sm:px-16 py-4 sm:py-6 border-2 border-text-secondary/50 text-text-primary hover:border-text-primary hover:bg-white/5 transition-all">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
      </div>

      {/* Content Preview Section - Above the fold */}
      <div className="py-8 sm:py-12 bg-background-dark/50">
        <div className="container-netflix mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary text-center mb-2">
            Watch Now - No Account Needed to Preview
          </h2>
          <p className="text-sm sm:text-base text-text-secondary text-center">
            Browse our collection and sign up to start watching
          </p>
        </div>
        <ContentPreviewCarousel />
      </div>

      {/* Features Section */}
      <div className="py-12 sm:py-16 bg-card/30">
        <div className="container-netflix px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
            <div className={hasAnimated ? 'animate-fade-in' : 'opacity-0'} style={{ animationDelay: hasAnimated ? '1s' : '0' }}>
              <div className="flex justify-center mb-3 sm:mb-4">
                <Play className="h-10 sm:h-12 w-10 sm:w-12 text-primary-red" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2 font-manrope">
                Watch Instantly
              </h3>
              <p className="text-sm sm:text-base text-text-secondary font-manrope">
                Stream on any device, see analytics in real-time
              </p>
            </div>
            
            <div className={hasAnimated ? 'animate-fade-in' : 'opacity-0'} style={{ animationDelay: hasAnimated ? '1.2s' : '0' }}>
              <div className="flex justify-center mb-3 sm:mb-4">
                <Star className="h-10 sm:h-12 w-10 sm:w-12 text-primary-red" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2 font-manrope">
                Premium Content
              </h3>
              <p className="text-sm sm:text-base text-text-secondary font-manrope">
                From hedgehog blockbusters to PostHog demos
              </p>
            </div>
            
            <div className={hasAnimated ? 'animate-fade-in' : 'opacity-0'} style={{ animationDelay: hasAnimated ? '1.4s' : '0' }}>
              <div className="flex justify-center mb-3 sm:mb-4">
                <Users className="h-10 sm:h-12 w-10 sm:w-12 text-primary-red" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2 font-manrope">
                Multiple Profiles
              </h3>
              <p className="text-sm sm:text-base text-text-secondary font-manrope">
                Experience personalized analytics insights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What You'll Find Section */}
      <div className="py-16 bg-card">
        <div className="container-netflix">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">What You'll Find</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              More than just entertainment - discover how PostHog analytics powers every interaction
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div className="text-center md:text-left">
              <div className="flex justify-center md:justify-start mb-4">
                <Play className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Entertainment</h3>
              <p className="text-muted-foreground">
                Quirky hedgehog-themed movies and shows that bring joy while showcasing 
                real streaming platform functionality you'd expect from any modern service.
              </p>
            </div>
            
            <div className="text-center md:text-left">
              <div className="flex justify-center md:justify-start mb-4">
                <BarChart3 className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Analytics in Action</h3>
              <p className="text-muted-foreground">
                Every click, view, and interaction is tracked with PostHog, giving you 
                firsthand experience of how powerful analytics can transform user insights.
              </p>
            </div>
          </div>

          <div className="mt-12 p-6 bg-primary/5 border border-primary/10 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-foreground mb-2">Coming Soon: PostHog Demos</h4>
                <p className="text-muted-foreground">
                  We're building a dedicated library where customers can view and bookmark 
                  interactive PostHog feature demonstrations. Experience analytics, feature flags, 
                  session recordings, and more through guided, hands-on examples.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle PostHog Badge */}
      <div className="py-8 bg-background border-t border-border">
        <div className="container-netflix">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>Powered by PostHog Analytics - Every interaction tracked for demonstration</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
