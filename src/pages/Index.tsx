import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { useAnimateOnce } from '@/hooks/useAnimateOnce';
import { Button } from '@/components/ui/button';
import ContentPreviewCarousel from '@/components/ContentPreviewCarousel';
import { Play, Star, Users, BarChart3, Eye, Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { selectedProfile } = useProfile();
  const hasAnimated = useAnimateOnce(100);

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
      {/* Hero Section */}
      <div className="relative h-screen bg-gradient-to-br from-primary-red/20 via-background-dark to-background-dark">
        {/* Background Pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, #e50914 0%, transparent 50%),
                              radial-gradient(circle at 75% 75%, #221f1f 0%, transparent 50%)`,
          }}
        />
        
        {/* Hero Content */}
        <div className="relative container-netflix h-full flex flex-col justify-center items-center text-center px-4">
          <div className="max-w-4xl w-full">
            {/* Logo */}
            <h1 className={`text-4xl sm:text-6xl lg:text-8xl font-bold text-primary-red mb-4 sm:mb-6 font-manrope ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}>
              HogFlix
            </h1>
            
            {/* Main Headline */}
            <h2 className={`text-2xl sm:text-4xl lg:text-6xl font-bold text-text-primary mb-6 sm:mb-8 font-manrope leading-tight px-2 ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: hasAnimated ? '0.2s' : '0' }}>
              Unlimited movies, TV shows, and more
            </h2>
            
            {/* Subheadline */}
            <p className={`text-lg sm:text-xl lg:text-2xl text-text-secondary mb-3 sm:mb-4 font-manrope max-w-2xl mx-auto px-4 ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: hasAnimated ? '0.4s' : '0' }}>
              From hedgehog adventures to PostHog demos - discover content that entertains and educates.
            </p>
            
            <p className={`text-base sm:text-lg text-text-tertiary mb-8 sm:mb-12 font-manrope px-4 ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: hasAnimated ? '0.6s' : '0' }}>
              Ready to explore? Create your account and dive into our unique streaming experience.
            </p>
            
            {/* CTA Button */}
            <div className={hasAnimated ? 'animate-fade-in' : 'opacity-0'} style={{ animationDelay: hasAnimated ? '0.8s' : '0' }}>
              <Link to="/signup">
                <Button className="btn-primary text-lg sm:text-xl px-8 sm:px-12 py-3 sm:py-4 text-white hover:bg-primary-red/90 transition-colors">
                  Sign Up Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Features Section */}
        <div className="absolute bottom-4 sm:bottom-20 left-0 right-0">
          <div className="container-netflix px-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 text-center">
              <div className={`${hasAnimated ? 'animate-fade-in' : 'opacity-0'} hidden sm:block`} style={{ animationDelay: hasAnimated ? '1s' : '0' }}>
                <div className="flex justify-center mb-2 sm:mb-4">
                  <Play className="h-8 sm:h-12 w-8 sm:w-12 text-primary-red" />
                </div>
                <h3 className="text-sm sm:text-lg font-semibold text-text-primary mb-1 sm:mb-2 font-manrope">
                  Watch Instantly
                </h3>
                <p className="text-xs sm:text-base text-text-secondary font-manrope">
                  Stream on any device, see analytics in real-time
                </p>
              </div>
              
              <div className={hasAnimated ? 'animate-fade-in' : 'opacity-0'} style={{ animationDelay: hasAnimated ? '1.2s' : '0' }}>
                <div className="flex justify-center mb-2 sm:mb-4">
                  <Star className="h-8 sm:h-12 w-8 sm:w-12 text-primary-red" />
                </div>
                <h3 className="text-sm sm:text-lg font-semibold text-text-primary mb-1 sm:mb-2 font-manrope">
                  Premium Content
                </h3>
                <p className="text-xs sm:text-base text-text-secondary font-manrope">
                  From hedgehog blockbusters to PostHog demos
                </p>
              </div>
              
              <div className={`${hasAnimated ? 'animate-fade-in' : 'opacity-0'} hidden sm:block`} style={{ animationDelay: hasAnimated ? '1.4s' : '0' }}>
                <div className="flex justify-center mb-2 sm:mb-4">
                  <Users className="h-8 sm:h-12 w-8 sm:w-12 text-primary-red" />
                </div>
                <h3 className="text-sm sm:text-lg font-semibold text-text-primary mb-1 sm:mb-2 font-manrope">
                  Multiple Profiles
                </h3>
                <p className="text-xs sm:text-base text-text-secondary font-manrope">
                  Experience personalized analytics insights
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Login Link */}
        <div className="absolute top-4 sm:top-8 right-4 sm:right-8">
          <Link to="/login">
            <Button variant="ghost" className="text-text-primary hover:text-primary-red font-manrope text-sm sm:text-base">
              Sign In
            </Button>
          </Link>
        </div>
      </div>

      {/* Content Preview Section */}
      <ContentPreviewCarousel />

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
