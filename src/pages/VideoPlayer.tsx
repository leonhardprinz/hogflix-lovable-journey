import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePostHog, useFeatureFlagEnabled } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { trackVideoCompletion, trackVideoStarted } from '@/lib/posthog-utils';
import Header from '@/components/Header';
import { HedgehogRating } from '@/components/HedgehogRating';
import { WatchlistButton } from '@/components/WatchlistButton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AiSummaryPanel } from '@/components/AiSummaryPanel';
import { UnifiedVideoPlayer } from '@/components/UnifiedVideoPlayer';
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
  const lastSaveTime = useRef(0);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [showStartOverButton, setShowStartOverButton] = useState(false);
  const [categoryName, setCategoryName] = useState<string>('Unknown');
  const [currentTime, setCurrentTime] = useState(0);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [hasEarlyAccess, setHasEarlyAccess] = useState(false);
  const aiSummariesFlagEnabled = useFeatureFlagEnabled('early_access_ai_summaries');
  
  const hasAppliedResume = useRef(false);
  const initialProgressRef = useRef<typeof progress | null>(null);
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const { progress, saveProgress, loadProgress } = useWatchProgress(videoId);

  // Handle time updates with progress tracking
  const handleTimeUpdate = (currentTimeValue: number, duration: number) => {
    setCurrentTime(currentTimeValue);
    
    if (video && selectedProfile) {
      const progressPercentage = (currentTimeValue / duration) * 100;
      const now = Date.now();

      // Save progress every 10 seconds once meaningful watching has occurred
      if (now - lastSaveTime.current >= 10000 && currentTimeValue >= 3 && duration > 0) {
        saveProgress(video.id, currentTimeValue, duration, sessionId);
        lastSaveTime.current = now;
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
        
        // Video completed event for A/B test tracking
        posthog.capture('video:completed', {
          content_id: video.id,
          category: categoryName,
          source_section: sourceSection,
          completion_pct: Math.round(progressPercentage),
          watch_seconds: Math.round(currentTimeValue),
          profile_id: selectedProfile.id,
          session_id: sessionId
        });
        
        // Update user properties
        setTimeout(async () => {
          const { count: completedCount } = await supabase
            .from('watch_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user?.id)
            .eq('completed', true);
          
          const { data: watchData } = await supabase
            .from('watch_progress')
            .select('progress_seconds')
            .eq('user_id', user?.id);
          
          const totalMinutes = Math.round(
            (watchData?.reduce((sum, w) => sum + (w.progress_seconds || 0), 0) || 0) / 60
          );
          
          trackVideoCompletion(completedCount || 0, totalMinutes);
        }, 0);
      }
    }
  };

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
        
        // Video started event for A/B test tracking
        posthog.capture('video:started', {
          content_id: videoId,
          category: fetchedCategoryName,
          source_section: sourceSection,
          has_resume_point: !!(progressData && progressData.progress_seconds > 0),
          profile_id: selectedProfile?.id,
          session_id: sessionId
        });
        
        // Update user properties - query for total videos watched count
        setTimeout(async () => {
          const { count: watchedCount } = await supabase
            .from('watch_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user?.id);
          
          trackVideoStarted(watchedCount || 0);
        }, 0);

      } catch (err) {
        console.error('❌ Error initializing player:', err);
        setError('Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    initializePlayer();
  }, [navigate, selectedProfile, videoId, loadProgress, sessionId, posthog, video, categoryName, milestone25, milestone50, milestone75, user, saveProgress]);

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

  // Handle video ready callback
  const handleVideoReady = () => {
    if (import.meta.env.DEV) {
      console.log('📋 Video ready');
    }
  };

  // Handle start over button
  const handleStartOver = () => {
    setResumeMessage(null);
    setShowStartOverButton(false);
  };

  // Handle continue button
  const handleContinue = () => {
    setResumeMessage(null);
    setShowStartOverButton(false);
  };

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

  // PostHog tracking callbacks for UnifiedVideoPlayer
  const handleVideoAreaClick = (action: 'play' | 'pause', currentTime: number) => {
    posthog.capture('video:click_toggle', {
      video_id: video?.id,
      action,
      current_time_s: currentTime,
      category: categoryName,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handleBackClick = () => {
    navigate('/browse');
  };

  const handlePlaybackRateChange = (rate: number) => {
    posthog.capture('video:playback_rate_changed', {
      video_id: videoId,
      playback_rate: rate,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handleSkipBackward = (currentTimeValue: number) => {
    posthog.capture('video:skip_backward', {
      video_id: videoId,
      current_time: currentTimeValue,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handleSkipForward = (currentTimeValue: number) => {
    posthog.capture('video:skip_forward', {
      video_id: videoId,
      current_time: currentTimeValue,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
  };

  const handlePiPToggle = (isActive: boolean) => {
    posthog.capture(isActive ? 'video:pip_enabled' : 'video:pip_disabled', {
      video_id: videoId,
      profile_id: selectedProfile?.id,
      session_id: sessionId
    });
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
          <div className="mb-8">
            {videoUrl ? (
              <UnifiedVideoPlayer
                videoUrl={videoUrl}
                thumbnailUrl={video.thumbnail_url}
                duration={video.duration}
                isHLS={isHLS}
                resumeMessage={resumeMessage}
                showStartOverButton={showStartOverButton}
                onContinue={handleContinue}
                onStartOver={handleStartOver}
                onVideoAreaClick={handleVideoAreaClick}
                onPlaybackRateChange={handlePlaybackRateChange}
                onSkipBackward={handleSkipBackward}
                onSkipForward={handleSkipForward}
                onPiPToggle={handlePiPToggle}
                onTimeUpdate={handleTimeUpdate}
                onReady={handleVideoReady}
                autoplay={false}
              />
            ) : (
              <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                <div className="flex items-center gap-3 text-white">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="font-manrope">Loading video player...</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Summary Panel (Early Access Feature) */}
          {hasEarlyAccess && aiSummariesFlagEnabled && (
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