import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePostHog, useFeatureFlagEnabled } from 'posthog-js/react';
import Hls from 'hls.js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
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
  const [userRating, setUserRating] = useState<number | null>(null);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [lastSaveTime, setLastSaveTime] = useState(0);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [showStartOverButton, setShowStartOverButton] = useState(false);
  
  const hlsRef = useRef<Hls | null>(null);
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const { progress, saveProgress, loadProgress } = useWatchProgress(videoId);
  
  // Feature flag for new player UI
  const isNewPlayerUiEnabled = useFeatureFlagEnabled('new-player-ui');

  // Video player hook with progress tracking
  const { videoRef, videoProps, isPlaying, isReady, play, pause, togglePlayPause, seekTo } = useVideoPlayer({
    autoplay: false, // We'll control autoplay manually for better timing
    onTimeUpdate: (currentTime, duration) => {
      if (video && selectedProfile) {
        const progressPercentage = (currentTime / duration) * 100;
        const now = Date.now();

        // Save progress every 10 seconds (reduced frequency) once meaningful watching has occurred
        if (now - lastSaveTime >= 10000 && currentTime >= 3 && duration > 0) {
          // Non-blocking progress save
          saveProgress(video.id, currentTime, duration, sessionId);
          setLastSaveTime(now);
        }

        // Track milestone progress
        if (!milestone25 && progressPercentage >= 25) {
          setMilestone25(true);
          posthog.capture('video:progress_milestone', {
            video_id: video.id,
            milestone: 25,
            profile_id: selectedProfile.id,
            session_id: sessionId
          });
        }

        if (!milestone50 && progressPercentage >= 50) {
          setMilestone50(true);
          posthog.capture('video:progress_milestone', {
            video_id: video.id,
            milestone: 50,
            profile_id: selectedProfile.id,
            session_id: sessionId
          });
        }

        if (!milestone75 && progressPercentage >= 75) {
          setMilestone75(true);
          posthog.capture('video:progress_milestone', {
            video_id: video.id,
            milestone: 75,
            profile_id: selectedProfile.id,
            session_id: sessionId
          });
        }

        // Track completion
        if (progressPercentage >= 95) {
          const sourceSection = sessionStorage.getItem('video_source_section') || 'unknown';
          
          posthog.capture('video:completed', {
            video_id: video.id,
            session_id: sessionId,
            profile_id: selectedProfile.id,
            total_duration: duration
          });
          
          // Content complete event for A/B test tracking
          posthog.capture('content_complete', {
            content_id: video.id,
            source_section: sourceSection,
            completion_pct: Math.round(progressPercentage),
            watch_seconds: Math.round(currentTime),
            profile_id: selectedProfile.id,
            session_id: sessionId
          });
        }
      }
    }
  });

  useEffect(() => {
    const initializePlayer = async () => {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/login');
        return;
      }

      if (!selectedProfile) {
        navigate('/profiles');
        return;
      }

      if (!videoId) {
        setError('No video ID provided');
        setLoading(false);
        return;
      }

      try {
        console.log('🎬 Initializing video player for:', videoId);
        
        // Step 1: Load video metadata
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single();

        if (videoError || !videoData) {
          setError('Video not found');
          setLoading(false);
          return;
        }

        console.log('📹 Video metadata loaded:', videoData.title);
        setVideo(videoData);

        // Step 2: Load watch progress first
        console.log('📊 Loading watch progress...');
        const progressData = await loadProgress(videoId);
        console.log('📊 Progress data:', progressData);

        // Step 3: Get video URL
        const { data: urlData, error: urlError } = await supabase.functions.invoke('get-video-url', {
          body: { videoId }
        });

        if (urlError || !urlData?.signedUrl) {
          setError('Could not load video');
          console.error('Video URL error:', urlError);
          setLoading(false);
          return;
        }

        console.log('🔗 Video URL obtained');
        setVideoUrl(urlData.signedUrl);
        setIsHLS(urlData.isHLS || urlData.signedUrl.includes('.m3u8'));

        // Step 4: Load rating data
        await loadRatingData();

        // Step 5: Setup resume message if meaningful progress exists
        if (progressData && progressData.progress_seconds > 3 && progressData.progress_percentage < 95) {
          const resumeTime = progressData.progress_seconds;
          const minutes = Math.floor(resumeTime / 60);
          const seconds = Math.floor(resumeTime % 60);
          setResumeMessage(`Resume from ${minutes}:${seconds.toString().padStart(2, '0')}?`);
          setShowStartOverButton(true);
          console.log('📺 Resume message set for', resumeTime, 'seconds');
        }

        // Get source section from session storage
        const sourceSection = sessionStorage.getItem('video_source_section') || 'unknown';
        
        // PostHog analytics
        posthog.capture('video:session_started', {
          video_id: videoId,
          video_title: videoData.title,
          profile_id: selectedProfile?.id,
          session_id: sessionId,
          has_resume_point: !!(progressData && progressData.progress_seconds > 0)
        });
        
        // Content start event for A/B test tracking
        posthog.capture('content_start', {
          content_id: videoId,
          source_section: sourceSection,
          profile_id: selectedProfile?.id,
          session_id: sessionId
        });

      } catch (err) {
        console.error('❌ Error initializing player:', err);
        setError('Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    initializePlayer();
  }, [navigate, selectedProfile, videoId, loadProgress, sessionId, posthog]);

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

  // Setup video player when URL is ready
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    console.log('🎥 Setting up video player');

    const handleLoadedMetadata = async () => {
      console.log('📋 Video metadata loaded, duration:', videoRef.current?.duration);
      
      const videoElement = videoRef.current;
      if (!videoElement) return;

      // Apply resume time if we have meaningful progress
      if (progress && progress.progress_seconds > 3 && progress.progress_percentage < 95) {
        const resumeTime = Math.min(progress.progress_seconds, videoElement.duration || 0);
        console.log('⏯️ Applying resume time:', resumeTime, 'seconds');
        
        if (resumeTime > 3) {
          // For HLS videos, we need to wait for seeking to complete
          if (isHLS) {
            videoElement.currentTime = resumeTime;
            // Wait for seek to complete before playing
            await new Promise((resolve) => {
              const onSeeked = () => {
                videoElement.removeEventListener('seeked', onSeeked);
                resolve(void 0);
              };
              videoElement.addEventListener('seeked', onSeeked);
              
              // Timeout fallback
              setTimeout(resolve, 1000);
            });
          } else {
            videoElement.currentTime = resumeTime;
          }
          
          console.log('✅ Resume time set to:', videoElement.currentTime);
        }
        
        posthog.capture('video:session_resumed', {
          video_id: videoId,
          session_id: sessionId,
          resumed_at_seconds: resumeTime,
          profile_id: selectedProfile?.id
        });
      }
      
      // Auto-play the video after seeking is complete
      console.log('▶️ Starting video playback...');
      try {
        await videoElement.play();
        console.log('✅ Video started successfully');
      } catch (error) {
        console.log('⚠️ Autoplay failed (user interaction required):', error);
      }
    };

    if (isHLS) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, handleLoadedMetadata);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('🔴 Fatal HLS error:', data);
            setError('Video playback failed');
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
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      }
    } else {
      // Regular MP4 video
      videoRef.current.src = videoUrl;
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, [videoUrl, isHLS, progress, videoId, sessionId, selectedProfile, posthog]);

  // Handle start over button
  const handleStartOver = () => {
    seekTo(0);
    setResumeMessage(null);
    setShowStartOverButton(false);
  };

  // Handle continue button (dismiss message and start playing from resume point)
  const handleContinue = async () => {
    setResumeMessage(null);
    setShowStartOverButton(false);
    
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Apply resume time before playing
    if (progress && progress.progress_seconds > 3) {
      const resumeTime = Math.min(progress.progress_seconds, videoElement.duration || 0);
      console.log('▶️ Continuing from:', resumeTime, 'seconds');
      
      if (isHLS) {
        // For HLS, wait for seek completion
        videoElement.currentTime = resumeTime;
        await new Promise((resolve) => {
          const onSeeked = () => {
            videoElement.removeEventListener('seeked', onSeeked);
            resolve(void 0);
          };
          videoElement.addEventListener('seeked', onSeeked);
          setTimeout(resolve, 500);
        });
      } else {
        videoElement.currentTime = resumeTime;
      }
    }
    
    // Start playing
    play();
  };

  // Fullscreen functionality
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      setIsFullscreen(isCurrentlyFullscreen);
      
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
                  {...videoProps}
                  className="w-full h-full"
                  controls={!isNewPlayerUiEnabled}
                  poster={video.thumbnail_url}
                  preload="metadata"
                >
                  {!isHLS && <source src={videoUrl} type="video/mp4" />}
                  Your browser does not support the video tag.
                </video>
                
                {/* Resume Message Overlay */}
                {resumeMessage && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="bg-background-dark/90 p-6 rounded-lg border border-white/20 text-center">
                      <p className="text-white text-lg mb-4 font-manrope">{resumeMessage}</p>
                      <div className="flex gap-4 justify-center">
                        <Button onClick={handleContinue} variant="default">
                          Continue
                        </Button>
                        <Button onClick={handleStartOver} variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                          Start Over
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Custom Controls Overlay */}
                {isNewPlayerUiEnabled && !resumeMessage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors group">
                    <Button
                      onClick={togglePlayPause}
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