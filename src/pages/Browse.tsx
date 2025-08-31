import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Play, Info } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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

      // Fire PostHog analytics for page view
      posthog.capture('page:viewed_browse', {
        profile_id: selectedProfile.id,
        profile_name: selectedProfile.display_name || selectedProfile.email
      });

      // Fetch categories and videos
      await fetchCategoriesAndVideos();
    };

    checkAuthAndProfile();
  }, [navigate, selectedProfile, posthog]);

  const fetchCategoriesAndVideos = async () => {
    try {
      // Fetch categories ordered by sort_order
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        return;
      }

      // Fetch videos for each category (first 10 per category)
      const categoriesWithVideos = await Promise.all(
        categoriesData.map(async (category) => {
          const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('category_id', category.id)
            .limit(10);

          if (videosError) {
            console.error(`Error fetching videos for category ${category.name}:`, videosError);
            return { ...category, videos: [] };
          }

          return { ...category, videos: videos || [] };
        })
      );

      setCategories(categoriesWithVideos);
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

        {/* Dynamic Categories and Videos */}
        <div className="space-y-16">
          {categories.map((category) => (
            <div key={category.id}>
              <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope">
                {category.name}
              </h3>
              
              {/* Horizontal Scrolling Carousel */}
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
                  {category.videos.map((video) => (
                    <Link
                      key={video.id}
                      to={`/watch/${video.id}`}
                      className="flex-shrink-0"
                      data-ph-capture-attribute-video-id={video.id}
                    >
                      <div className="w-80 bg-card-background rounded card-hover cursor-pointer group">
                        <div className="aspect-video bg-gray-700 rounded-t overflow-hidden">
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-4">
                          <h4 className="text-text-primary font-manrope font-medium mb-2 truncate">
                            {video.title}
                          </h4>
                          <p className="text-text-tertiary text-sm font-manrope">
                            {formatDuration(video.duration)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Browse;