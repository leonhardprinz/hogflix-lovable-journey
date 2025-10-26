import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
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
import { VideoControls } from '@/components/VideoControls';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { AiSummaryPanel } from '@/components/AiSummaryPanel';
import { toast } from 'sonner';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  category_id: string;
  ai_summary: string | null;
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
  const [categoryName, setCategoryName] = useState<string>('Unknown');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [hasEarlyAccess, setHasEarlyAccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const isPiPSupported = 'pictureInPictureEnabled' in document;
  
  const hlsRef = useRef<Hls | null>(null);
  const hasAppliedResume = useRef(false);
  const initialProgressRef = useRef<typeof progress | null>(null);
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const { progress, saveProgress, loadProgress } = useWatchProgress(videoId);

  // Video player hook with progress tracking and enhanced controls
  const { 
    videoRef, 
    videoProps, 
    isPlaying, 
    isReady, 
    play, 
    pause, 
    togglePlayPause, 
    seekTo,
    playbackRate,
    changePlaybackRate,
    skipBackward,
    skipForward,
    togglePiP,
    isPiPActive
  } = useVideoPlayer({
    autoplay: false, // We'll control autoplay manually for better timing
    onTimeUpdate: (currentTimeValue, duration) => {
      setCurrentTime(currentTimeValue);
      
      if (video && selectedProfile) {
        const progressPercentage = (currentTimeValue / duration) * 100;
        const now = Date.now();

        // Save progress every 10 seconds (reduced frequency) once meaningful watching has occurred
        if (now - lastSaveTime >= 10000 && currentTimeValue >= 3 && duration > 0) {
          // Non-blocking progress save
          saveProgress(video.id, currentTimeValue, duration, sessionId);
          setLastSaveTime(now);
        }

        // Track milestone progress
        if (!milestone25 && progressPercentage >= 25) {
          setMilestone25(true);
          posthog.capture('video:progress_milestone', {
            video_id: video.id,
            milestone: 25,
            category: categoryName,
            profile_id: selectedProfile.id,
            session_id: sessionId
          });
        }

        if (!milestone50 && progressPercentage >= 50) {
          setMilestone50(true);
          posthog.capture('video:progress_milestone', {
            video_id: video.id,
            milestone: 50,
            category: categoryName,
            profile_id: selectedProfile.id,
            session_id: sessionId
          });
        }

        if (!milestone75 && progressPercentage >= 75) {
          setMilestone75(true);
          posthog.capture('video:progress_milestone', {
            video_id: video.id,
            milestone: 75,
            category: categoryName,
            profile_id: selectedProfile.id,
            session_id: sessionId
          });
        }

        // Track completion
        if (progressPercentage >= 95) {
          const sourceSection = sessionStorage.getItem('video_source_section') || 'unknown';
          
          posthog.capture('video:completed', {
            video_id: video.id,
            category: categoryName,
            session_id: sessionId,
            profile_id: selectedProfile.id,
            total_duration: duration
          });
          
          // Content complete event for A/B test tracking
          posthog.capture('content_complete', {
            content_id: video.id,
            category: categoryName,
            source_section: sourceSection,
            completion_pct: Math.round(progressPercentage),
            watch_seconds: Math.round(currentTimeValue),
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
        if (import.meta.env.DEV) {
          console.log('🎬 Initializing video player for:', videoId);
        }
        
        // Step 1: Load video metadata
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('*, ai_summary')
          .eq('id', videoId)
          .single();

        if (videoError || !videoData) {
          setError('Video not found');
          setLoading(false);
          return;
        }

        if (import.meta.env.DEV) {
          console.log('📹 Video metadata loaded:', videoData.title);
        }
        setVideo(videoData);
        setAiSummary(videoData.ai_summary);
        
        // Fetch category name separately (no FK relationship exists)
        let fetchedCategoryName = 'Unknown';
        if (videoData.category_id) {
          const { data: categoryData } = await supabase
            .from('categories')
            .select('name')
            .eq('id', videoData.category_id)
            .single();
          
          fetchedCategoryName = categoryData?.name || 'Unknown';
        }
        setCategoryName(fetchedCategoryName);

        // Step 2: Load watch progress first
        if (import.meta.env.DEV) {
          console.log('📊 Loading watch progress...');
        }
        const progressData = await loadProgress(videoId);
        initialProgressRef.current = progressData; // Store in ref instead of triggering re-renders
        if (import.meta.env.DEV) {
          console.log('📊 Progress data:', progressData);
        }

        // Step 3: Get video URL
        const { data: urlData, error: urlError } = await supabase.functions.invoke('get-video-url', {
          body: { videoId }
        });

        if (urlError || !urlData?.signedUrl) {
          setError('Could not load video');
          if (import.meta.env.DEV) {
            console.error('Video URL error:', urlError);
          }
          setLoading(false);
          return;
        }

        if (import.meta.env.DEV) {
          console.log('🔗 Video URL obtained');
        }
        setVideoUrl(urlData.signedUrl);
        setIsHLS(urlData.isHLS || urlData.signedUrl.includes('.m3u8'));

        // Step 4: Load rating data
        await loadRatingData();

        // Step 5: Setup resume message if meaningful progress exists
        const resumeProgress = initialProgressRef.current;
        if (resumeProgress && resumeProgress.progress_seconds > 3 && resumeProgress.progress_percentage < 95) {
          const resumeTime = resumeProgress.progress_seconds;
          const minutes = Math.floor(resumeTime / 60);
          const seconds = Math.floor(resumeTime % 60);
          setResumeMessage(`Resume from ${minutes}:${seconds.toString().padStart(2, '0')}?`);
          setShowStartOverButton(true);
          if (import.meta.env.DEV) {
            console.log('📺 Resume message set for', resumeTime, 'seconds');
          }
        }

        // Get source section from session storage
        const sourceSection = sessionStorage.getItem('video_source_section') || 'unknown';
        const sectionPriorityVariant = posthog.getFeatureFlag('Popular_vs_Trending_Priority_Algo_Test') || 'unknown';
        
        // PostHog analytics
        posthog.capture('video:session_started', {
          video_id: videoId,
          video_title: videoData.title,
          category: fetchedCategoryName,
          profile_id: selectedProfile?.id,
          session_id: sessionId,
          has_resume_point: !!(progressData && progressData.progress_seconds > 0),
          source_section: sourceSection,
          source_section_variant: sectionPriorityVariant
        });
        
        // Content start event for A/B test tracking
        posthog.capture('content_start', {
          content_id: videoId,
          category: fetchedCategoryName,
          source_section: sourceSection,
          has_resume_point: !!(progressData && progressData.progress_seconds > 0),
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

    if (import.meta.env.DEV) {
      console.log('🎥 Setting up video player');
    }

  const handleLoadedMetadata = async () => {
    if (import.meta.env.DEV) {
      console.log('📋 Video metadata loaded, duration:', videoRef.current?.duration);
    }
    
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Don't interrupt if video is already playing
    if (!videoElement.paused) {
      console.log('⚠️ Video already playing, skipping setup');
      return;
    }

    // Apply resume time if we have meaningful progress (ONLY ONCE)
    const resumeProgress = initialProgressRef.current;
    if (resumeProgress && resumeProgress.progress_seconds > 3 && resumeProgress.progress_percentage < 95 && !hasAppliedResume.current) {
      hasAppliedResume.current = true;
      const resumeTime = Math.min(resumeProgress.progress_seconds, videoElement.duration || 0);
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
          category: categoryName,
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
        // Don't add loadedmetadata listener - videoProps already has it
      }
    } else {
      // Regular MP4 video
      videoRef.current.src = videoUrl;
      // Don't add loadedmetadata listener - videoProps already has it
    }
  }, [videoUrl, isHLS, videoId, sessionId, selectedProfile, posthog]);

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

    // Apply resume time before playing (using initial progress ref)
    const resumeProgress = initialProgressRef.current;
    if (resumeProgress && resumeProgress.progress_seconds > 3) {
      const resumeTime = Math.min(resumeProgress.progress_seconds, videoElement.duration || 0);
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

  // Check if user has early access to AI summaries
  useEffect(() => {
    const checkEarlyAccess = async () => {
      if (!selectedProfile?.id) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('early_access_features')
        .eq('id', selectedProfile.id)
        .single();
      
      const hasAccess = profile?.early_access_features?.includes('ai_summaries') || false;
      setHasEarlyAccess(hasAccess);
      
      // Check feature flag from PostHog
      const flagEnabled = posthog.getFeatureFlag('early_access_ai_summaries') === true;
      
      if (hasAccess && flagEnabled && import.meta.env.DEV) {
        console.log('✨ AI Summaries early access enabled');
      }
    };
    
    checkEarlyAccess();
  }, [selectedProfile, posthog]);

  const handleGenerateSummary = async () => {
    if (!video?.id || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-video-summary', {
        body: { videoId: video.id }
      });
      
      if (error) throw error;
      
      setAiSummary(data.summary);
      
      // Track summary generation
      posthog.capture('ai_summary:generated', {
        video_id: video.id,
        video_title: video.title,
        cached: data.cached || false
      });
      
      // Track summary viewed
      posthog.capture('ai_summary:viewed', {
        video_id: video.id,
        video_title: video.title
      });
      
      toast.success('✨ AI Summary generated!');
      if (import.meta.env.DEV) {
        console.log('✅ AI Summary generated');
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
      toast.error('Failed to generate summary. Please try again.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleBackClick = () => {
    navigate('/browse');
  };

  // Video controls handlers
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(videoRef.current.volume);
      }
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    changePlaybackRate(rate);
    posthog.capture('video:playback_rate_changed', {
      video_id: videoId,
      playback_rate: rate,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handleSkipBackward = () => {
    skipBackward(10);
    posthog.capture('video:skip_backward', {
      video_id: videoId,
      current_time: currentTime,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handleSkipForward = () => {
    skipForward(10);
    posthog.capture('video:skip_forward', {
      video_id: videoId,
      current_time: currentTime,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handlePiPToggle = () => {
    togglePiP();
    const willBeActive = !isPiPActive;
    posthog.capture(willBeActive ? 'video:pip_enabled' : 'video:pip_disabled', {
      video_id: videoId,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Controls visibility management
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'f':
          e.preventDefault();
          handleFullscreenToggle();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.05));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.05));
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          handleSkipBackward();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          handleSkipForward();
          break;
        case 'p':
          e.preventDefault();
          if (isPiPSupported) {
            handlePiPToggle();
          }
          break;
        case '<':
        case ',':
          if (e.shiftKey) {
            e.preventDefault();
            const newRate = Math.max(0.25, playbackRate - 0.25);
            handlePlaybackRateChange(newRate);
          }
          break;
        case '>':
        case '.':
          if (e.shiftKey) {
            e.preventDefault();
            const newRate = Math.min(2, playbackRate + 0.25);
            handlePlaybackRateChange(newRate);
          }
          break;
        case 'escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
        default:
          // Number keys for seeking to percentage (0-9 for 0%-90%)
          const num = parseInt(e.key);
          if (!isNaN(num) && num >= 0 && num <= 9 && videoRef.current) {
            e.preventDefault();
            const duration = videoRef.current.duration;
            if (duration) {
              seekTo((num / 10) * duration);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, playbackRate, isPiPSupported, currentTime]);

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
          <div 
            ref={containerRef}
            className="aspect-video bg-black rounded-lg overflow-hidden mb-8 relative group"
            onMouseMove={resetControlsTimeout}
            onMouseEnter={resetControlsTimeout}
          >
            {videoUrl ? (
              <>
                <video
                  {...videoProps}
                  className="w-full h-full"
                  controls={false}
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
                
                {/* Unified Video Controls */}
                {!resumeMessage && (
                  <>
                    {/* Center Play Button */}
                    {!isPlaying && isReady && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Button
                          onClick={togglePlayPause}
                          variant="ghost"
                          size="lg"
                          className="bg-white/20 hover:bg-white/30 text-white border-0 h-20 w-20 rounded-full pointer-events-auto backdrop-blur-sm"
                        >
                          <Play className="h-8 w-8 ml-1" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Video Controls Bar */}
                    <div 
                      className={`transition-opacity duration-300 ${
                        showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <VideoControls
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        duration={videoRef.current?.duration || 0}
                        volume={volume}
                        isMuted={isMuted}
                        playbackRate={playbackRate}
                        isFullscreen={isFullscreen}
                        isPiPSupported={isPiPSupported}
                        onPlayPause={togglePlayPause}
                        onSeek={seekTo}
                        onVolumeChange={handleVolumeChange}
                        onMuteToggle={handleMuteToggle}
                        onPlaybackRateChange={handlePlaybackRateChange}
                        onSkipBackward={handleSkipBackward}
                        onSkipForward={handleSkipForward}
                        onPiPToggle={handlePiPToggle}
                        onFullscreenToggle={handleFullscreenToggle}
                      />
                    </div>
                  </>
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

          {/* AI Summary Panel (Early Access Feature) */}
          {hasEarlyAccess && posthog.getFeatureFlag('early_access_ai_summaries') === true && (
            <AiSummaryPanel
              videoId={video.id}
              videoTitle={video.title}
              existingSummary={aiSummary}
              onGenerate={handleGenerateSummary}
              isGenerating={isGeneratingSummary}
            />
          )}

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