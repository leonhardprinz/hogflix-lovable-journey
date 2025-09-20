import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { useAnimateOnce } from '@/hooks/useAnimateOnce';
import { Button } from '@/components/ui/button';
import { Play, Star, Users, Clock } from 'lucide-react';

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
              Watch anywhere. Cancel anytime.
            </p>
            
            <p className={`text-base sm:text-lg text-text-tertiary mb-8 sm:mb-12 font-manrope px-4 ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: hasAnimated ? '0.6s' : '0' }}>
              Ready to watch? Enter your email to create or restart your membership.
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
                  Stream on any device
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
                  Exclusive shows and movies
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
                  Create profiles for everyone
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
    </div>
  );
};

export default Index;
