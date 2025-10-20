import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  duration: number;
  categories?: { name: string };
}

const ContentPreviewCarousel = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select(`
            id, title, description, thumbnail_url, duration,
            categories!videos_category_id_fkey!inner (
              name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) throw error;
        setVideos(data || []);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) {
    return (
      <div className="py-12 bg-background">
        <div className="container-netflix">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">Loading Content...</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-video bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 bg-background">
      <div className="container-netflix">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">What's Available</h2>
        <p className="text-muted-foreground mb-8">From hedgehog blockbusters to upcoming PostHog feature demos</p>
        
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {videos.map((video) => (
              <Card key={video.id} className="w-64 bg-card border-border hover:scale-105 transition-transform duration-200 group cursor-pointer relative">
                <CardContent className="p-0">
                  <div className="relative">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full aspect-video object-cover rounded-t-lg"
                    />
                    <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors duration-200 rounded-t-lg flex items-center justify-center">
                      {user ? (
                        <PlayCircle className="w-12 h-12 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center gap-2">
                          <PlayCircle className="w-12 h-12 text-primary" />
                          <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Link to="/signup">Sign Up to Watch</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="bg-background/80 text-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground mb-2 truncate">{video.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {video.description || 'No description available'}
                    </p>
                    {!user && (
                      <div className="mt-2">
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link to="/signup">Sign Up to Watch</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentPreviewCarousel;