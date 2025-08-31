import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Play, Info } from 'lucide-react';

const Browse = () => {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile } = useProfile();

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

      // Fire PostHog analytics for page view
      posthog.capture('page:viewed_browse', {
        profile_id: selectedProfile.id,
        profile_name: selectedProfile.display_name || selectedProfile.email
      });
    };

    checkAuthAndProfile();
  }, [navigate, selectedProfile, posthog]);

  if (!selectedProfile) {
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
      <div className="relative h-[70vh] bg-gradient-to-r from-background-dark via-background-dark/80 to-transparent">
        {/* Hero Background - Placeholder for now */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{
            backgroundImage: `linear-gradient(45deg, #1a1a1a 25%, transparent 25%), 
                             linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), 
                             linear-gradient(45deg, transparent 75%, #1a1a1a 75%), 
                             linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}
        />
        
        {/* Hero Content */}
        <div className="relative container-netflix h-full flex flex-col justify-center">
          <div className="max-w-2xl">
            <h1 className="text-5xl lg:text-7xl font-bold text-text-primary mb-4 font-manrope animate-fade-in">
              Featured Title
            </h1>
            <p className="text-lg lg:text-xl text-text-secondary mb-6 font-manrope max-w-lg animate-fade-in" style={{ animationDelay: '0.2s' }}>
              This is a placeholder for a featured movie or series description. 
              In a real Netflix clone, this would showcase the current featured content.
            </p>
            
            {/* Action Buttons */}
            <div className="flex gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Button className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
                <Play size={20} fill="currentColor" />
                PLAY
              </Button>
              <Button 
                variant="outline" 
                className="text-lg px-8 py-3 flex items-center gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Info size={20} />
                MORE INFO
              </Button>
            </div>
          </div>
        </div>
        
        {/* Fade gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background-dark to-transparent" />
      </div>

      {/* Content Carousels Container */}
      <div className="container-netflix py-12 space-y-12">
        {/* Profile Welcome Message */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-text-primary font-manrope">
            Welcome back, {selectedProfile.display_name || selectedProfile.email?.split('@')[0] || 'User'}
            {selectedProfile.is_kids_profile && (
              <span className="ml-2 bg-primary-red text-white text-sm px-2 py-1 rounded">KIDS</span>
            )}
          </h2>
        </div>

        {/* Carousel Sections - Placeholders for now */}
        <div className="space-y-16">
          <div>
            <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">Continue Watching</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div 
                  key={item} 
                  className="aspect-video bg-card-background rounded card-hover cursor-pointer flex items-center justify-center"
                >
                  <span className="text-text-tertiary font-manrope">Content {item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">Trending Now</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div 
                  key={item} 
                  className="aspect-video bg-card-background rounded card-hover cursor-pointer flex items-center justify-center"
                >
                  <span className="text-text-tertiary font-manrope">Trending {item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">Popular on HogFlix</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div 
                  key={item} 
                  className="aspect-video bg-card-background rounded card-hover cursor-pointer flex items-center justify-center"
                >
                  <span className="text-text-tertiary font-manrope">Popular {item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Browse;