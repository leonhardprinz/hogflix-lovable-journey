import { useEffect, useRef, useState, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useSyntheticCheck } from '@/hooks/useSyntheticCheck';
import { VideoControls } from './VideoControls';
import { Play } from 'lucide-react';
import { Button } from './ui/button';

interface DemoVideoPlayerProps {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  autoplay?: boolean;
}

export const DemoVideoPlayer = ({
  videoId,
  videoTitle,
  videoUrl,
  thumbnailUrl,
  duration,
  autoplay = true,
}: DemoVideoPlayerProps) => {
  const posthog = usePostHog();
  const isSynthetic = useSyntheticCheck();
  const containerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const trackedDeciles = useRef(new Set<number>());
  const hasPlayedRef = useRef(false);
  const sessionIdRef = useRef(crypto.randomUUID());
  const isPiPSupported = 'pictureInPictureEnabled' in document;

  const { saveProgress } = useWatchProgress(videoId);

  const getSharedProperties = useCallback((progressPct: number, currentTimeS: number) => ({
    category: "PostHog Demo",
    video_id: videoId,
    video_title: videoTitle,
    player: "html5",
    autoplay,
    duration_sec: duration,
    current_time_s: currentTimeS,
    progress_pct: progressPct,
  }), [videoId, videoTitle, autoplay, duration]);

  const handleTimeUpdate = useCallback((currentTimeValue: number, durationValue: number) => {
    setCurrentTime(currentTimeValue);
    
    // Save progress to database (for Continue Watching)
    saveProgress(videoId, currentTimeValue, durationValue, sessionIdRef.current);
    
    if (durationValue > 0) {
      const progressPct = Math.floor((currentTimeValue / durationValue) * 100);
      
      // Track deciles (10, 20, 30...90) for PostHog (skip if synthetic)
      if (!isSynthetic) {
        for (let decile = 10; decile <= 90; decile += 10) {
          if (progressPct >= decile && !trackedDeciles.current.has(decile)) {
            trackedDeciles.current.add(decile);
            posthog.capture('demo_video:progress', getSharedProperties(decile, currentTimeValue));
            console.log(`📊 PostHog: demo_video:progress at ${decile}%`);
          }
        }
      }
    }
  }, [posthog, getSharedProperties, saveProgress, videoId, isSynthetic]);

  const handlePlay = useCallback(() => {
    if (!hasPlayedRef.current && !isSynthetic) {
      hasPlayedRef.current = true;
      posthog.capture('demo_video:played', getSharedProperties(0, 0));
      console.log('▶️ PostHog: demo_video:played');
    }
  }, [posthog, getSharedProperties, isSynthetic]);

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
  } = useVideoPlayer({
    onTimeUpdate: handleTimeUpdate,
    onPlay: handlePlay,
    autoplay,
  });

  const handleEnded = useCallback(() => {
    if (!isSynthetic) {
      posthog.capture('demo_video:completed', getSharedProperties(100, duration));
      console.log('✅ PostHog: demo_video:completed');
    }
  }, [posthog, getSharedProperties, duration, isSynthetic]);

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

  const handleFullscreenToggle = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.addEventListener('ended', handleEnded);
      return () => videoElement.removeEventListener('ended', handleEnded);
    }
  }, [videoRef, handleEnded]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        {...videoProps}
        src={videoUrl}
        poster={thumbnailUrl}
        className="w-full h-full"
        playsInline
      />

      {/* Unified Video Controls */}
      <>
        {/* Center Play Button */}
        {!isPlaying && isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Button
              onClick={play}
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
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            playbackRate={playbackRate}
            isFullscreen={isFullscreen}
            isPiPSupported={isPiPSupported}
            onPlayPause={togglePlayPause}
            onSeek={seekTo}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onPlaybackRateChange={changePlaybackRate}
            onSkipBackward={() => skipBackward(10)}
            onSkipForward={() => skipForward(10)}
            onPiPToggle={togglePiP}
            onFullscreenToggle={handleFullscreenToggle}
          />
        </div>
      </>
    </div>
  );
};
