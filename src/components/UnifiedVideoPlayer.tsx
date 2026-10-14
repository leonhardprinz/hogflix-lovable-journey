import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { VideoControls } from './VideoControls';
import { Play, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface UnifiedVideoPlayerProps {
  // Core video data
  videoUrl: string | null;
  thumbnailUrl: string;
  duration: number;
  isHLS?: boolean;

  // Resume watching (optional)
  resumeMessage?: string | null;
  showStartOverButton?: boolean;
  onContinue?: () => void;
  onStartOver?: () => void;

  // Callbacks for custom tracking
  onVideoAreaClick?: (action: 'play' | 'pause', currentTime: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
  onSkipBackward?: (currentTime: number) => void;
  onSkipForward?: (currentTime: number) => void;
  onPiPToggle?: (isActive: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onReady?: () => void;
  // Fires when the media element actually starts rendering frames.
  onPlaybackStarted?: () => void;
  // Fires when playback stops to buffer or the media stops loading.
  onStalled?: () => void;
  // Fires when the media element, HLS, or a play() call fails fatally.
  onError?: (message: string) => void;

  // Optional autoplay
  autoplay?: boolean;
}

export const UnifiedVideoPlayer = ({
  videoUrl,
  thumbnailUrl,
  duration,
  isHLS = false,
  resumeMessage,
  showStartOverButton,
  onContinue,
  onStartOver,
  onVideoAreaClick,
  onPlaybackRateChange,
  onSkipBackward,
  onSkipForward,
  onPiPToggle,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  onReady,
  onPlaybackStarted,
  onStalled,
  onError,
  autoplay = true,
}: UnifiedVideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hlsRecoveryRef = useRef(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const bufferingTimeoutRef = useRef<NodeJS.Timeout>();
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isPiPSupported = 'pictureInPictureEnabled' in document;

  const handleTimeUpdateInternal = useCallback((currentTimeValue: number, durationValue: number) => {
    setCurrentTime(currentTimeValue);
    onTimeUpdate?.(currentTimeValue, durationValue);
  }, [onTimeUpdate]);

  const handlePlayInternal = useCallback(() => {
    onPlay?.();
  }, [onPlay]);

  const handlePauseInternal = useCallback(() => {
    onPause?.();
  }, [onPause]);

  const handleErrorInternal = useCallback((message: string) => {
    setIsBuffering(false);
    setPlaybackError(message);
    onError?.(message);
  }, [onError]);

  const handlePlayingInternal = useCallback(() => {
    setIsBuffering(false);
    setPlaybackError(null);
    hlsRecoveryRef.current = 0;
    onPlaybackStarted?.();
  }, [onPlaybackStarted]);

  const handleWaitingInternal = useCallback(() => {
    setIsBuffering(true);
    onStalled?.();
  }, [onStalled]);

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
    isPiPActive,
  } = useVideoPlayer({
    onTimeUpdate: handleTimeUpdateInternal,
    onPlay: handlePlayInternal,
    onPause: handlePauseInternal,
    onPlaying: handlePlayingInternal,
    onWaiting: handleWaitingInternal,
    onStalled: handleWaitingInternal,
    onError: handleErrorInternal,
    autoplay,
  });

  // Store onReady in a ref to avoid it causing effect re-runs
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Setup HLS or direct video source
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    if (isHLS) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          onReadyRef.current?.();
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (!data.fatal) return;
          console.error('🔴 Fatal HLS error:', data);

          // hls.js can recover network and media errors — try once each before
          // surfacing a real failure to the viewer.
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && hlsRecoveryRef.current < 2) {
            hlsRecoveryRef.current += 1;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hlsRecoveryRef.current < 2) {
            hlsRecoveryRef.current += 1;
            hls.recoverMediaError();
          } else {
            handleErrorInternal(`Streaming failed (${data.details})`);
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
        videoRef.current.load();
      }
    } else {
      // Regular MP4 video — only set src if it actually changed
      if (videoRef.current.src !== videoUrl) {
        videoRef.current.src = videoUrl;
      } else if (reloadKey > 0) {
        // Retry with the same URL — force the element to reload.
        videoRef.current.load();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, isHLS, reloadKey]);

  // Track the real media duration so the controls reflect the media element,
  // not a database value that stays correct while the player is frozen.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDuration = () => {
      setMediaDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('loadedmetadata', updateDuration);
    return () => {
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [videoRef]);

  // Watchdog: if playback stays stuck buffering, surface a failure state
  // instead of spinning forever.
  useEffect(() => {
    if (!isBuffering || playbackError) return;

    bufferingTimeoutRef.current = setTimeout(() => {
      handleErrorInternal('The video stopped loading. Check your connection and try again.');
    }, 15000);

    return () => {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
      }
    };
  }, [isBuffering, playbackError, handleErrorInternal]);

  const handleRetry = useCallback(() => {
    setPlaybackError(null);
    setIsBuffering(true);
    hlsRecoveryRef.current = 0;
    setReloadKey((key) => key + 1);
  }, []);

  // Handle video ended event
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !onEnded) return;

    const handleEnded = () => onEnded();
    videoElement.addEventListener('ended', handleEnded);
    return () => videoElement.removeEventListener('ended', handleEnded);
  }, [videoRef, onEnded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'arrowleft':
          e.preventDefault();
          skipBackward(10);
          onSkipBackward?.(currentTime);
          break;
        case 'arrowright':
          e.preventDefault();
          skipForward(10);
          onSkipForward?.(currentTime);
          break;
        case 'j':
          e.preventDefault();
          skipBackward(10);
          onSkipBackward?.(currentTime);
          break;
        case 'l':
          e.preventDefault();
          skipForward(10);
          onSkipForward?.(currentTime);
          break;
        case 'f':
          e.preventDefault();
          handleFullscreenToggle();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'p':
          if (isPiPSupported) {
            e.preventDefault();
            togglePiP();
            onPiPToggle?.(!isPiPActive);
          }
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, skipBackward, skipForward, volume, isPiPSupported, togglePiP, isPiPActive, currentTime, onSkipBackward, onSkipForward, onPiPToggle]);

  // Auto-hide controls after 3 seconds of inactivity
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    setShowControls(true);

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

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

  const handlePlaybackRateChangeInternal = (rate: number) => {
    changePlaybackRate(rate);
    onPlaybackRateChange?.(rate);
  };

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleVideoAreaClick = useCallback(() => {
    const action = isPlaying ? 'pause' : 'play';
    togglePlayPause();
    onVideoAreaClick?.(action, currentTime);
  }, [isPlaying, togglePlayPause, onVideoAreaClick, currentTime]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseMove={resetControlsTimeout}
      onMouseEnter={resetControlsTimeout}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        {...videoProps}
        poster={thumbnailUrl}
        className="w-full h-full"
        playsInline
      />

      {/* Click overlay for play/pause - excludes controls area */}
      <div
        className="absolute inset-0 bottom-16 cursor-pointer z-10"
        onClick={handleVideoAreaClick}
      />

      {/* Resume watching overlay */}
      {resumeMessage && showStartOverButton && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 backdrop-blur-sm">
          <div className="bg-background/95 backdrop-blur-md p-8 rounded-xl shadow-2xl max-w-md mx-4 border border-border/50">
            <h3 className="text-xl font-semibold mb-4 text-foreground">{resumeMessage}</h3>
            <div className="flex gap-3">
              <Button onClick={onContinue} className="flex-1" size="lg">
                Continue
              </Button>
              <Button onClick={onStartOver} variant="outline" className="flex-1" size="lg">
                Start Over
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Buffering spinner */}
      {isBuffering && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <Loader2 className="h-12 w-12 animate-spin text-white/90" />
        </div>
      )}

      {/* Playback failure state with retry */}
      {playbackError && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm">
          <div className="text-center max-w-md mx-4 px-6">
            <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-white">Playback failed</h3>
            <p className="text-white/70 text-sm mb-6">{playbackError}</p>
            <Button onClick={handleRetry} size="lg" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Center Play Button */}
      {!isPlaying && isReady && !isBuffering && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
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
        className={`relative z-30 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
      >
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={mediaDuration}
          volume={volume}
          isMuted={isMuted}
          playbackRate={playbackRate}
          isFullscreen={isFullscreen}
          isPiPSupported={isPiPSupported}
          onPlayPause={togglePlayPause}
          onSeek={seekTo}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onPlaybackRateChange={handlePlaybackRateChangeInternal}
          onSkipBackward={() => {
            skipBackward(10);
            onSkipBackward?.(currentTime);
          }}
          onSkipForward={() => {
            skipForward(10);
            onSkipForward?.(currentTime);
          }}
          onPiPToggle={() => {
            togglePiP();
            onPiPToggle?.(!isPiPActive);
          }}
          onFullscreenToggle={handleFullscreenToggle}
        />
      </div>
    </div>
  );
};
