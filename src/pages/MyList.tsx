import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useWatchlist } from '@/contexts/WatchlistContext';
import Header from '@/components/Header';
import DemoBanner from '@/components/DemoBanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HedgehogRating } from '@/components/HedgehogRating';
import { Heart, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  duration: number;
  averageRating?: number;
  ratingCount?: number;
}

export default function MyList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const { watchlist, removeFromWatchlist } = useWatchlist();
  const navigate = useNavigate();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const fetchWatchlistVideos = async () => {
    if (!user || !selectedProfile || watchlist.length === 0) {
      setVideos([]);
      setLoading(false);
      return;
    }

    try {
      const { data: videosData, error } = await supabase
        .from('videos')
        .select('*')
        .in('id', watchlist);

      if (error) throw error;

      // Fetch ratings for each video
      const videosWithRatings = await Promise.all(
        videosData.map(async (video) => {
          try {
            const [avgRatingResult, ratingCountResult] = await Promise.all([
              supabase.rpc('get_video_average_rating', { video_id_param: video.id }),
              supabase.rpc('get_video_rating_count', { video_id_param: video.id })
            ]);

            return {
              ...video,
              averageRating: avgRatingResult.data || 0,
              ratingCount: ratingCountResult.data || 0
            };
          } catch (error) {
            console.error(`Error fetching ratings for video ${video.id}:`, error);
            return {
              ...video,
              averageRating: 0,
              ratingCount: 0
            };
          }
        })
      );

      setVideos(videosWithRatings);
    } catch (error) {
      console.error('Error fetching watchlist videos:', error);
      toast.error('Failed to load your watchlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlistVideos();
  }, [user, selectedProfile, watchlist]);

  const handleRemoveFromList = async (videoId: string) => {
    await removeFromWatchlist(videoId);
  };

  const handleWatchVideo = (videoId: string) => {
    navigate(`/watch/${videoId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Please log in to view your list</h1>
            <Button onClick={() => navigate('/login')}>Log In</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProfile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Please select a profile</h1>
            <Button onClick={() => navigate('/profiles')}>Select Profile</Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-lg">Loading your list...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DemoBanner />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <Heart className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold">My List</h1>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Your list is empty</h2>
            <p className="text-muted-foreground mb-4">
              Start adding videos to your list to watch them later
            </p>
            <Button onClick={() => navigate('/browse')}>
              Browse Videos
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video) => (
              <Card key={video.id} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative aspect-video overflow-hidden rounded-t-lg">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleWatchVideo(video.id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Watch
                      </Button>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveFromList(video.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-sm">
                      {formatDuration(video.duration)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                        {video.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <HedgehogRating
                        videoId={video.id}
                        averageRating={video.averageRating || 0}
                        totalRatings={video.ratingCount || 0}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleWatchVideo(video.id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Watch
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}