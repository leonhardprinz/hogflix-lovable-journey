import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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

const Hero = () => {
  const [featuredVideo, setFeaturedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedVideo = async () => {
      try {
        // Fetch the most recently added video
        const { data: video, error } = await supabase
          .from('videos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching featured video:', error);
          return;
        }

        setFeaturedVideo(video);
      } catch (error) {
        console.error('Error fetching featured video:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedVideo();
  }, []);

  if (loading || !featuredVideo) {
    return (
      <div className="relative h-[70vh] bg-gradient-to-r from-background via-background/80 to-transparent">
        <div className="absolute inset-0 bg-muted/20" />
        <div className="relative container mx-auto h-full flex flex-col justify-center px-4">
          <div className="max-w-2xl">
            <div className="h-12 bg-muted animate-pulse rounded mb-4" />
            <div className="h-6 bg-muted animate-pulse rounded mb-6 w-3/4" />
            <div className="flex gap-4">
              <div className="h-12 w-32 bg-muted animate-pulse rounded" />
              <div className="h-12 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] bg-gradient-to-r from-background via-background/80 to-transparent">
      {/* Hero Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${featuredVideo.thumbnail_url})`,
        }}
      />
      
      {/* Overlay gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      
      {/* Hero Content */}
      <div className="relative container mx-auto h-full flex flex-col justify-center px-4">
        <div className="max-w-2xl">
          <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-4 animate-fade-in">
            {featuredVideo.title}
          </h1>
          {featuredVideo.description && (
            <p className="text-lg lg:text-xl text-muted-foreground mb-6 max-w-lg animate-fade-in line-clamp-3" 
               style={{ animationDelay: '0.2s' }}>
              {featuredVideo.description}
            </p>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Button 
              asChild
              size="lg" 
              className="text-lg px-8 py-3 flex items-center gap-2"
            >
              <Link to={`/watch/${featuredVideo.id}`}>
                <Play size={20} fill="currentColor" />
                Play
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-3 flex items-center gap-2 bg-background/20 border-border/30 text-foreground hover:bg-background/40"
            >
              <Info size={20} />
              More Info
            </Button>
          </div>
        </div>
      </div>
      
      {/* Fade gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};

export default Hero;