import { useRef, useCallback, useState } from 'react';

interface UseVideoPlayerOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  autoplay?: boolean;
}

export const useVideoPlayer = (options: UseVideoPlayerOptions = {}) => {
  const { onTimeUpdate, onPlay, onPause, autoplay = true } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const play = useCallback(async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        setIsPlaying(true);
        onPlay?.();
        console.log('▶️ Video playing');
      } catch (error) {
        console.log('⚠️ Play failed:', error);
      }
    }
  }, [onPlay]);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      onPause?.();
      console.log('⏸️ Video paused');
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
      console.log('⏭️ Seeked to:', time, 'seconds');
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    console.log('📋 Video metadata loaded, duration:', videoRef.current?.duration);
    setIsReady(true);
    
    if (autoplay) {
      // Small delay to ensure everything is ready
      setTimeout(() => {
        play();
      }, 100);
    }
  }, [autoplay, play]);

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

  // Video event handlers to attach to the video element
  const videoProps = {
    ref: videoRef,
    onLoadedMetadata: handleLoadedMetadata,
    onTimeUpdate: handleTimeUpdateInternal,
    onPlay: handlePlay,
    onPause: handlePause,
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
  };
};