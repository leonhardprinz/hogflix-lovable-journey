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
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPiPActive, setIsPiPActive] = useState(false);

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

  const changePlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      console.log('⚡ Playback rate changed to:', rate);
      
      // Store preference in localStorage
      try {
        localStorage.setItem('hogflix_playback_speed', rate.toString());
      } catch (error) {
        console.warn('Failed to save playback speed preference:', error);
      }
    }
  }, []);

  const skipBackward = useCallback((seconds: number = 10) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - seconds);
      console.log('⏪ Skipped backward:', seconds, 'seconds');
    }
  }, []);

  const skipForward = useCallback((seconds: number = 10) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration || 0,
        videoRef.current.currentTime + seconds
      );
      console.log('⏩ Skipped forward:', seconds, 'seconds');
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
        console.log('📺 PiP disabled');
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
        console.log('📺 PiP enabled');
      }
    } catch (error) {
      console.warn('⚠️ PiP error:', error);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    console.log('📋 Video metadata loaded, duration:', videoRef.current?.duration);
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
            console.log('⚡ Applied saved playback speed:', rate);
          }
        }
      } catch (error) {
        console.warn('Failed to load playback speed preference:', error);
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
    playbackRate,
    changePlaybackRate,
    skipBackward,
    skipForward,
    togglePiP,
    isPiPActive,
  };
};