import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePostHog, useFeatureFlagEnabled } from 'posthog-js/react';
import Hls from 'hls.js';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, Pause } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  category_id: string;
}

const VideoPlayer = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isHLS, setIsHLS] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [milestone25, setMilestone25] = useState(false);
  const [milestone50, setMilestone50] = useState(false);
  const [milestone75, setMilestone75] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile } = useProfile();
  const isNewPlayerUiEnabled = useFeatureFlagEnabled('new-player-ui');

  useEffect(() => {
    const checkAuthAndLoadVideo = async () => {
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

      if (!videoId) {
        setError('Video ID not found');
        setLoading(false);
        return;
      }

      await loadVideoData();
    };

    checkAuthAndLoadVideo();
  }, [videoId, navigate, selectedProfile]);

  const loadVideoData = async () => {
    try {
      // Fetch video data
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (videoError) {
        console.error('Error fetching video:', videoError);
        setError('Video not found');
        return;
      }

      setVideo(videoData);

      // Get signed URL from edge function
      const { data: urlData, error: urlError } = await supabase.functions
        .invoke('get-video-url', {
          body: { videoId: videoId }
        });

      if (urlError || !urlData?.signedUrl) {
        console.error('Error getting video URL:', urlError);
        setError('Failed to load video');
        return;
      }

      setVideoUrl(urlData.signedUrl);
      setIsHLS(urlData.isHLS || false);

      // Fire PostHog analytics for video view
      if (selectedProfile) {
        posthog.capture('video:watched', {
          video_id: videoId,
          video_title: videoData.title,
          video_category_id: videoData.category_id,
          profile_id: selectedProfile.id,
          profile_name: selectedProfile.display_name || selectedProfile.email
        });
      }

    } catch (error) {
      console.error('Error loading video:', error);
      setError('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  // Setup HLS player when videoUrl and isHLS are available
  useEffect(() => {
    if (videoUrl && isHLS && videoRef.current) {
      if (Hls.isSupported()) {
        // Cleanup previous HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        const hls = new Hls({
          enableWorker: false,
        });
        
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(videoRef.current);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest loaded, levels:', hls.levels);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', event, data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Fatal network error encountered, trying to recover');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error encountered, trying to recover');
                hls.recoverMediaError();
                break;
              default:
                console.log('Fatal error, cannot recover');
                hls.destroy();
                setError('Failed to load video stream');
                break;
            }
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        videoRef.current.src = videoUrl;
      } else {
        setError('HLS not supported in this browser');
      }
    }

    // Cleanup on unmount
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl, isHLS]);

  const handleBackClick = () => {
    navigate('/browse');
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget;
    const currentTime = videoElement.currentTime;
    const duration = videoElement.duration;
    
    if (duration > 0) {
      const progressPercent = (currentTime / duration) * 100;
      
      // Check for 25% milestone
      if (progressPercent >= 25 && !milestone25) {
        setMilestone25(true);
        posthog.capture('video:progress_report', {
          video_id: videoId,
          progress_percent: 25
        });
      }
      
      // Check for 50% milestone
      if (progressPercent >= 50 && !milestone50) {
        setMilestone50(true);
        posthog.capture('video:progress_report', {
          video_id: videoId,
          progress_percent: 50
        });
      }
      
      // Check for 75% milestone
      if (progressPercent >= 75 && !milestone75) {
        setMilestone75(true);
        posthog.capture('video:progress_report', {
          video_id: videoId,
          progress_percent: 75
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Header />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="flex items-center gap-3 text-text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="font-manrope">Loading video...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Header />
        <div className="container-netflix py-12">
          <Button
            onClick={handleBackClick}
            variant="outline"
            className="mb-8 bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Browse
          </Button>
          
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-text-primary font-manrope mb-4">
              {error || 'Video not found'}
            </h1>
            <p className="text-text-secondary font-manrope">
              The video you're looking for couldn't be loaded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <Header />
      
      <div className="container-netflix py-8">
        {/* Back Button */}
        <Button
          onClick={handleBackClick}
          variant="outline"
          className="mb-8 bg-white/10 border-white/30 text-white hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Browse
        </Button>

        {/* Video Player Section */}
        <div className="max-w-6xl mx-auto">
          <div className="aspect-video bg-black rounded-lg overflow-hidden mb-8 relative">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full"
                  controls={!isNewPlayerUiEnabled}
                  poster={video.thumbnail_url}
                  preload="metadata"
                   onTimeUpdate={handleTimeUpdate}
                   onPlay={handleVideoPlay}
                   onPause={handleVideoPause}
                 >
                   {!isHLS && <source src={videoUrl} type="video/mp4" />}
                   Your browser does not support the video tag.
                 </video>
                
                {/* Custom Controls Overlay (only when feature flag is enabled) */}
                {isNewPlayerUiEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors group">
                    <Button
                      onClick={handlePlayPause}
                      variant="ghost"
                      size="lg"
                      className="bg-white/20 hover:bg-white/30 text-white border-0 h-20 w-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isPlaying ? (
                        <Pause className="h-8 w-8" />
                      ) : (
                        <Play className="h-8 w-8 ml-1" />
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-3 text-white">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="font-manrope">Loading video player...</span>
                </div>
              </div>
            )}
          </div>

          {/* Video Information */}
          <div className="space-y-4">
            <h1 className="text-3xl lg:text-4xl font-bold text-text-primary font-manrope">
              {video.title}
            </h1>
            
            {video.description && (
              <p className="text-text-secondary font-manrope text-lg leading-relaxed max-w-4xl">
                {video.description}
              </p>
            )}
            
            <div className="text-text-tertiary font-manrope">
              Duration: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;