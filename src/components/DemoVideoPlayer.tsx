import { useRef, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useSyntheticCheck } from '@/hooks/useSyntheticCheck';
import { UnifiedVideoPlayer } from './UnifiedVideoPlayer';

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
  const trackedDeciles = useRef(new Set<number>());
  const hasPlayedRef = useRef(false);
  const sessionIdRef = useRef(crypto.randomUUID());

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

  const handleEnded = useCallback(() => {
    if (!isSynthetic) {
      posthog.capture('demo_video:completed', getSharedProperties(100, duration));
      console.log('✅ PostHog: demo_video:completed');
    }
  }, [posthog, getSharedProperties, duration, isSynthetic]);

  const handleVideoAreaClick = useCallback((action: 'play' | 'pause', currentTimeValue: number) => {
    if (!isSynthetic) {
      posthog.capture('demo_video:click_toggle', {
        video_id: videoId,
        video_title: videoTitle,
        action,
        current_time_s: currentTimeValue
      });
      console.log(`🖱️ PostHog: demo_video:click_toggle (${action})`);
    }
  }, [posthog, videoId, videoTitle, isSynthetic]);

  return (
    <UnifiedVideoPlayer
      videoUrl={videoUrl}
      thumbnailUrl={thumbnailUrl}
      duration={duration}
      onVideoAreaClick={handleVideoAreaClick}
      onTimeUpdate={handleTimeUpdate}
      onPlay={handlePlay}
      onEnded={handleEnded}
      autoplay={autoplay}
    />
  );
};
