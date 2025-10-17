import { useEffect, useRef, useState, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const trackedDeciles = useRef(new Set<number>());
  const hasPlayedRef = useRef(false);

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
    
    if (durationValue > 0) {
      const progressPct = Math.floor((currentTimeValue / durationValue) * 100);
      
      // Track deciles (10, 20, 30...90)
      for (let decile = 10; decile <= 90; decile += 10) {
        if (progressPct >= decile && !trackedDeciles.current.has(decile)) {
          trackedDeciles.current.add(decile);
          posthog.capture('demo_video_progress', getSharedProperties(decile, currentTimeValue));
          console.log(`📊 PostHog: demo_video_progress at ${decile}%`);
        }
      }
    }
  }, [posthog, getSharedProperties]);

  const handlePlay = useCallback(() => {
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true;
      posthog.capture('demo_video_play', getSharedProperties(0, 0));
      console.log('▶️ PostHog: demo_video_play');
    }
  }, [posthog, getSharedProperties]);

  const {
    videoRef,
    videoProps,
    isPlaying,
    isReady,
    play,
    pause,
    togglePlayPause,
    seekTo,
  } = useVideoPlayer({
    onTimeUpdate: handleTimeUpdate,
    onPlay: handlePlay,
    autoplay,
  });

  const handleEnded = useCallback(() => {
    posthog.capture('demo_video_complete', getSharedProperties(100, duration));
    console.log('✅ PostHog: demo_video_complete');
  }, [posthog, getSharedProperties, duration]);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(videoRef.current.volume);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    seekTo(newTime);
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

      {/* Custom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-white/70 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlayPause}
            className="text-white hover:bg-white/20"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/20"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <div className="w-20">
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="cursor-pointer"
              />
            </div>
          </div>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-white hover:bg-white/20"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Play Overlay (when paused) */}
      {!isPlaying && isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Button
            variant="ghost"
            size="icon"
            onClick={play}
            className="h-16 w-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <Play className="h-8 w-8 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};
