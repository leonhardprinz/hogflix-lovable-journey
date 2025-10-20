import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useSyntheticCheck } from '@/hooks/useSyntheticCheck';
import Header from '@/components/Header';
import { DemoVideoPlayer } from '@/components/DemoVideoPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string;
  duration: number;
  category_id: string;
}

export default function DemoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const isSynthetic = useSyntheticCheck();
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !selectedProfile) {
      navigate('/profiles');
      return;
    }

    const fetchVideo = async () => {
      if (!id) {
        setError('No video ID provided');
        setLoading(false);
        return;
      }

      try {
        // Fetch video with category name
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select(`
            id,
            title,
            description,
            video_url,
            thumbnail_url,
            duration,
            category_id,
            categories!videos_category_id_fkey (
              name
            )
          `)
          .eq('id', id)
          .single();

        if (videoError) throw videoError;

        // Verify this is a PostHog Demo video
        const categoryName = (videoData as any).categories?.name;
        if (categoryName !== 'PostHog Demo') {
          setError('This video is not a PostHog Demo');
          setLoading(false);
          return;
        }

        setVideo(videoData);

        // Get signed URL for video
        const { data: { signedUrl: videoSignedUrl }, error: urlError } = await supabase
          .functions.invoke('get-video-url', {
            body: { path: videoData.video_url },
          });

        if (urlError) throw urlError;
        setSignedUrl(videoSignedUrl);

        // Capture demo_video_opened event (skip if synthetic)
        if (!isSynthetic) {
          posthog.capture('demo_video_opened', {
            category: "PostHog Demo",
            video_id: videoData.id,
            video_title: videoData.title,
            profile_id: selectedProfile.id,
            duration_sec: videoData.duration,
          });
          console.log('📂 PostHog: demo_video_opened');
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching demo video:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
        setLoading(false);
      }
    };

    fetchVideo();
  }, [id, user, selectedProfile, navigate, posthog, isSynthetic]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading demo...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !video || !signedUrl) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold mb-2">Unable to load demo</h2>
            <p className="text-muted-foreground mb-6">{error || 'Video not found'}</p>
            <Button onClick={() => navigate('/browse')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Browse
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/browse')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Browse
        </Button>

        {/* Video Player */}
        <div className="mb-8">
          <DemoVideoPlayer
            videoId={video.id}
            videoTitle={video.title}
            videoUrl={signedUrl}
            thumbnailUrl={video.thumbnail_url}
            duration={video.duration}
            autoplay={true}
          />
        </div>

        {/* Video Info */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  PostHog Demo
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(video.duration)}</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-2">{video.title}</h1>
            </div>
          </div>

          {video.description && (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground whitespace-pre-wrap">
                {video.description}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
