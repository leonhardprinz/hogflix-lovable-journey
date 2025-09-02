import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Play, Star, Users, Clock } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { selectedProfile } = useProfile();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // If authenticated and has selected profile, go to browse
        if (selectedProfile) {
          navigate('/browse');
        } else {
          // If authenticated but no profile selected, go to profiles
          navigate('/profiles');
        }
      }
    };

    checkAuthAndRedirect();
  }, [navigate, selectedProfile]);

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
        <div className="relative container-netflix h-full flex flex-col justify-center items-center text-center">
          <div className="max-w-4xl">
            {/* Logo */}
            <h1 className="text-6xl lg:text-8xl font-bold text-primary-red mb-6 font-manrope animate-fade-in">
              HogFlix
            </h1>
            
            {/* Main Headline */}
            <h2 className="text-4xl lg:text-6xl font-bold text-text-primary mb-8 font-manrope animate-fade-in leading-tight" style={{ animationDelay: '0.2s' }}>
              Unlimited movies, TV shows, and more
            </h2>
            
            {/* Subheadline */}
            <p className="text-xl lg:text-2xl text-text-secondary mb-4 font-manrope animate-fade-in max-w-2xl mx-auto" style={{ animationDelay: '0.4s' }}>
              Watch anywhere. Cancel anytime.
            </p>
            
            <p className="text-lg text-text-tertiary mb-12 font-manrope animate-fade-in" style={{ animationDelay: '0.6s' }}>
              Ready to watch? Enter your email to create or restart your membership.
            </p>
            
            {/* CTA Button */}
            <div className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
              <Link to="/signup">
                <Button className="btn-primary text-xl px-12 py-4 text-white hover:bg-primary-red/90 transition-colors">
                  Sign Up Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Features Section */}
        <div className="absolute bottom-20 left-0 right-0">
          <div className="container-netflix">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="animate-fade-in" style={{ animationDelay: '1s' }}>
                <div className="flex justify-center mb-4">
                  <Play className="h-12 w-12 text-primary-red" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2 font-manrope">
                  Watch Instantly
                </h3>
                <p className="text-text-secondary font-manrope">
                  Stream on any device
                </p>
              </div>
              
              <div className="animate-fade-in" style={{ animationDelay: '1.2s' }}>
                <div className="flex justify-center mb-4">
                  <Star className="h-12 w-12 text-primary-red" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2 font-manrope">
                  Premium Content
                </h3>
                <p className="text-text-secondary font-manrope">
                  Exclusive shows and movies
                </p>
              </div>
              
              <div className="animate-fade-in" style={{ animationDelay: '1.4s' }}>
                <div className="flex justify-center mb-4">
                  <Users className="h-12 w-12 text-primary-red" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2 font-manrope">
                  Multiple Profiles
                </h3>
                <p className="text-text-secondary font-manrope">
                  Create profiles for everyone
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Login Link */}
        <div className="absolute top-8 right-8">
          <Link to="/login">
            <Button variant="ghost" className="text-text-primary hover:text-primary-red font-manrope">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
