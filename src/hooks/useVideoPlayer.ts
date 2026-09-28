import { useRef, useCallback, useState } from 'react';

interface UseVideoPlayerOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  // Fires when the media element actually starts rendering frames.
  onPlaying?: () => void;
  // Fires when playback pauses to buffer or the media stops loading.
  onWaiting?: () => void;
  onStalled?: () => void;
  // Fires when the media element or a play() call fails.
  onError?: (message: string) => void;
  autoplay?: boolean;
}

export const useVideoPlayer = (options: UseVideoPlayerOptions = {}) => {
  const { onTimeUpdate, onPlay, onPause, onPlaying, onWaiting, onStalled, onError, autoplay = true } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPiPActive, setIsPiPActive] = useState(false);

  const play = useCallback(async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        setIsPlaying(true);
        onPlay?.();
        if (import.meta.env.DEV) {
          console.log('▶️ Video playing');
        }
      } catch (error) {
        setIsPlaying(false);
        // Autoplay policy rejections are expected — the user can still press play.
        // Any other rejection means the media genuinely could not start.
        const name = (error as Error)?.name;
        if (name !== 'NotAllowedError' && name !== 'AbortError') {
          onError?.((error as Error)?.message || 'Playback could not start');
        }
        if (import.meta.env.DEV) {
          console.log('⚠️ Play failed:', error);
        }
      }
    }
  }, [onPlay, onError]);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      onPause?.();
      if (import.meta.env.DEV) {
        console.log('⏸️ Video paused');
      }
    }
  }, [onPause]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, time);
      if (import.meta.env.DEV) {
        console.log('⏭️ Seeked to:', time, 'seconds');
      }
    }
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      if (import.meta.env.DEV) {
        console.log('⚡ Playback rate changed to:', rate);
      }
      
      // Store preference in localStorage
      try {
        localStorage.setItem('hogflix_playback_speed', rate.toString());
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to save playback speed preference:', error);
        }
      }
    }
  }, []);

  const skipBackward = useCallback((seconds: number = 10) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - seconds);
      if (import.meta.env.DEV) {
        console.log('⏪ Skipped backward:', seconds, 'seconds');
      }
    }
  }, []);

  const skipForward = useCallback((seconds: number = 10) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration || 0,
        videoRef.current.currentTime + seconds
      );
      if (import.meta.env.DEV) {
        console.log('⏩ Skipped forward:', seconds, 'seconds');
      }
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
        if (import.meta.env.DEV) {
          console.log('📺 PiP disabled');
        }
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
        if (import.meta.env.DEV) {
          console.log('📺 PiP enabled');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('⚠️ PiP error:', error);
      }
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('📋 Video metadata loaded, duration:', videoRef.current?.duration);
    }
    setIsReady(true);
    
    // Apply saved playback speed preference
    if (videoRef.current) {
      try {
        const savedSpeed = localStorage.getItem('hogflix_playback_speed');
        if (savedSpeed) {
          const rate = parseFloat(savedSpeed);
          if (rate >= 0.25 && rate <= 2) {
            videoRef.current.playbackRate = rate;
            setPlaybackRate(rate);
            if (import.meta.env.DEV) {
              console.log('⚡ Applied saved playback speed:', rate);
            }
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to load playback speed preference:', error);
        }
      }
    }
    
    // Note: Autoplay is now controlled externally to avoid race conditions
  }, []);

  const handleTimeUpdateInternal = useCallback(() => {
    if (videoRef.current) {
      onTimeUpdate?.(videoRef.current.currentTime, videoRef.current.duration);
    }
  }, [onTimeUpdate]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  const handlePlaying = useCallback(() => {
    setIsPlaying(true);
    onPlaying?.();
  }, [onPlaying]);

  const handleWaiting = useCallback(() => {
    onWaiting?.();
  }, [onWaiting]);

  const handleStalled = useCallback(() => {
    onStalled?.();
  }, [onStalled]);

  const handleError = useCallback(() => {
    setIsPlaying(false);
    const mediaError = videoRef.current?.error;
    const message = mediaError
      ? `Media error ${mediaError.code}: ${mediaError.message || 'the video failed to load'}`
      : 'The video failed to load';
    onError?.(message);
  }, [onError]);

  // Video event handlers to attach to the video element
  const videoProps = {
    ref: videoRef,
    onLoadedMetadata: handleLoadedMetadata,
    onTimeUpdate: handleTimeUpdateInternal,
    onPlay: handlePlay,
    onPause: handlePause,
    onPlaying: handlePlaying,
    onWaiting: handleWaiting,
    onStalled: handleStalled,
    onError: handleError,
  };

  return {
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
  };
};