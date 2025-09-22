import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePostHog, useFeatureFlagEnabled } from 'posthog-js/react';
import Hls from 'hls.js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import Header from '@/components/Header';
import { HedgehogRating } from '@/components/HedgehogRating';
import { WatchlistButton } from '@/components/WatchlistButton';
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
  const [userRating, setUserRating] = useState<number | null>(null);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [hasResumed, setHasResumed] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const { progress, saveProgress, loadProgress } = useWatchProgress(videoId);
  
  // Feature flag for new player UI
  const isNewPlayerUiEnabled = useFeatureFlagEnabled('new-player-ui');

  useEffect(() => {
    const checkAuth = async () => {
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

      // Load video data
      await loadVideoData();
    };

    checkAuth();
  }, [navigate, selectedProfile, videoId]);

  const loadVideoData = async () => {
    if (!videoId) return;

    try {
      // Fetch video metadata
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (videoError || !videoData) {
        setError('Video not found');
        return;
      }

      setVideo(videoData);

      // Get signed URL from edge function
      const { data: urlData, error: urlError } = await supabase.functions.invoke('get-video-url', {
        body: { videoId }
      });

      if (urlError || !urlData?.signedUrl) {
        setError('Could not load video');
        console.error('Video URL error:', urlError);
        return;
      }

      setVideoUrl(urlData.signedUrl);
      setIsHLS(urlData.isHLS || urlData.signedUrl.includes('.m3u8'));

      // Fetch rating data
      await loadRatingData();

      // Check for existing progress and resume if applicable
      const existingProgress = await loadProgress(videoId);
      const shouldResume = existingProgress && 
        existingProgress.progress_percentage > 5 && 
        existingProgress.progress_percentage < 95;

      // PostHog analytics for session start
      posthog.capture('video:session_started', {
        video_id: videoId,
        video_title: videoData.title,
        profile_id: selectedProfile?.id,
        session_id: sessionId,
        is_resume: shouldResume,
        resume_from_seconds: shouldResume ? existingProgress.progress_seconds : 0
      });
    } catch (err) {
      console.error('Error loading video:', err);
      setError('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const loadRatingData = async () => {
    if (!videoId) return;

    try {
      // Get average rating and count
      const { data: avgData } = await supabase.rpc('get_video_average_rating', { video_id_param: videoId });
      const { data: countData } = await supabase.rpc('get_video_rating_count', { video_id_param: videoId });
      
      setAverageRating(avgData || 0);
      setTotalRatings(countData || 0);

      // Get user's rating if authenticated and profile selected
      if (user && selectedProfile) {
        const { data: userRatingData } = await supabase.rpc('get_user_video_rating', { 
          video_id_param: videoId,
          profile_id_param: selectedProfile.id 
        });
        setUserRating(userRatingData || null);
      }
    } catch (err) {
      console.error('Error loading rating data:', err);
    }
  };

  // HLS setup and resume functionality
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    if (isHLS) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest loaded');
          handleVideoReady();
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Fatal network error encountered, try to recover');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error encountered, try to recover');
                hls.recoverMediaError();
                break;
              default:
                console.log('Fatal error, cannot recover');
                setError('Video playback error');
                hls.destroy();
                break;
            }
          }
        });

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        videoRef.current.src = videoUrl;
        videoRef.current.addEventListener('loadedmetadata', handleVideoReady);
      }
    } else {
      // Regular MP4 video
      videoRef.current.addEventListener('loadedmetadata', handleVideoReady);
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleVideoReady);
      }
    };
  }, [videoUrl, isHLS]);

  // Handle video ready and resume if needed
  const handleVideoReady = () => {
    if (!videoRef.current || !progress || hasResumed) return;
    
    const shouldResume = progress.progress_percentage > 5 && progress.progress_percentage < 95;
    
    if (shouldResume) {
      videoRef.current.currentTime = progress.progress_seconds;
      setHasResumed(true);
      
      posthog.capture('video:session_resumed', {
        video_id: videoId,
        session_id: sessionId,
        resumed_at_seconds: progress.progress_seconds,
        profile_id: selectedProfile?.id
      });
    }
  };

  // Fullscreen autoplay functionality
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      setIsFullscreen(isCurrentlyFullscreen);
      
      // Auto-play when entering fullscreen
      if (isCurrentlyFullscreen && videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleBackClick = () => {
    navigate('/browse');
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    posthog.capture('video:session_resumed', {
      video_id: videoId,
      session_id: sessionId,
      profile_id: selectedProfile?.id
    });
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    posthog.capture('video:session_paused', {
      video_id: videoId,
      session_id: sessionId,
      profile_id: selectedProfile?.id,
      current_seconds: videoRef.current?.currentTime || 0
    });
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && video && selectedProfile) {
      const currentTime = videoRef.current.currentTime;
      const duration = video.duration;
      const progressPercentage = (currentTime / duration) * 100;
      const now = Date.now();

      // Save progress every 15 seconds
      if (now - lastSaveTime >= 15000) {
        saveProgress(video.id, currentTime, duration, sessionId);
        setLastSaveTime(now);
      }

      // Track milestone progress with enhanced data
      if (!milestone25 && progressPercentage >= 25) {
        setMilestone25(true);
        posthog.capture('video:progress_report', {
          video_id: video.id,
          progress: 25,
          profile_id: selectedProfile.id,
          session_id: sessionId,
          watch_time_seconds: currentTime,
          is_continuous: !hasResumed || progress?.progress_seconds <= currentTime * 0.8
        });
      }

      if (!milestone50 && progressPercentage >= 50) {
        setMilestone50(true);
        posthog.capture('video:progress_report', {
          video_id: video.id,
          progress: 50,
          profile_id: selectedProfile.id,
          session_id: sessionId,
          watch_time_seconds: currentTime,
          is_continuous: !hasResumed || progress?.progress_seconds <= currentTime * 0.8
        });
      }

      if (!milestone75 && progressPercentage >= 75) {
        setMilestone75(true);
        posthog.capture('video:progress_report', {
          video_id: video.id,
          progress: 75,
          profile_id: selectedProfile.id,
          session_id: sessionId,
          watch_time_seconds: currentTime,
          is_continuous: !hasResumed || progress?.progress_seconds <= currentTime * 0.8
        });
      }

      // Track completion
      if (progressPercentage >= 90) {
        posthog.capture('video:session_ended', {
          video_id: video.id,
          session_id: sessionId,
          profile_id: selectedProfile.id,
          total_watch_time: currentTime,
          completion_percentage: progressPercentage,
          ended_reason: 'completed'
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
            
            <div className="text-text-tertiary font-manrope mb-6">
              Duration: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
            </div>

            {/* Add to Watchlist Button */}
            <div className="mb-6">
              <WatchlistButton
                videoId={video.id}
                size="lg"
              />
            </div>

            {/* Hedgehog Rating Section */}
            <div className="border-t border-white/10 pt-6">
              <HedgehogRating
                videoId={video.id}
                currentRating={userRating}
                averageRating={averageRating}
                totalRatings={totalRatings}
                size="large"
                showStats={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;