import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { usePostHog } from 'posthog-js/react';

interface WatchProgressData {
  progress_seconds: number;
  duration_seconds: number;
  progress_percentage: number;
  last_watched_at: string;
  completed: boolean;
  session_id: string | null;
}

interface VideoWithProgress {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  progress_seconds: number;
  progress_percentage: number;
  last_watched_at: string;
}

export const useWatchProgress = (videoId?: string) => {
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const posthog = usePostHog();
  const [progress, setProgress] = useState<WatchProgressData | null>(null);
  const [loading, setLoading] = useState(false);

  // Load existing progress for a video
  const loadProgress = useCallback(async (id: string) => {
    if (!user || !selectedProfile) return null;

    try {
      const { data, error } = await supabase
        .from('watch_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('profile_id', selectedProfile.id)
        .eq('video_id', id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error loading progress:', error);
      return null;
    }
  }, [user, selectedProfile]);

  // Save or update progress
  const saveProgress = useCallback(async (
    id: string,
    currentTime: number,
    duration: number,
    sessionId: string
  ) => {
    if (!user || !selectedProfile || currentTime < 0 || duration <= 0) return;

    const progressPercentage = (currentTime / duration) * 100;
    const isCompleted = progressPercentage >= 90; // Mark as completed at 90%

    try {
      const progressData = {
        user_id: user.id,
        profile_id: selectedProfile.id,
        video_id: id,
        progress_seconds: Math.floor(currentTime),
        duration_seconds: Math.floor(duration),
        progress_percentage: Number(progressPercentage.toFixed(2)),
        completed: isCompleted,
        session_id: sessionId,
        last_watched_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('watch_progress')
        .upsert(progressData);

      if (error) {
        console.error('Error saving progress:', error);
        return;
      }

      // Update local state
      setProgress(progressData);

      // PostHog tracking
      posthog.capture('video:progress_saved', {
        video_id: id,
        progress_seconds: Math.floor(currentTime),
        progress_percentage: Number(progressPercentage.toFixed(2)),
        session_id: sessionId,
        completed: isCompleted,
        profile_id: selectedProfile.id,
        auto_save: true
      });

      // Track completion event
      if (isCompleted) {
        posthog.capture('video:completed', {
          video_id: id,
          session_id: sessionId,
          profile_id: selectedProfile.id,
          total_duration: Math.floor(duration)
        });
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }, [user, selectedProfile, posthog]);

  // Get videos with resume progress (5% - 95% completion)
  const getResumeWatchingVideos = useCallback(async (): Promise<VideoWithProgress[]> => {
    if (!user || !selectedProfile) return [];

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('watch_progress')
        .select(`
          progress_seconds,
          progress_percentage,
          last_watched_at,
          video_id,
          videos!fk_watch_progress_video (
            id,
            title,
            description,
            thumbnail_url,
            video_url,
            duration
          )
        `)
        .eq('user_id', user.id)
        .eq('profile_id', selectedProfile.id)
        .eq('completed', false)
        .gte('progress_percentage', 5)
        .lte('progress_percentage', 95)
        .order('last_watched_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Error fetching resume watching videos:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        ...item.videos,
        progress_seconds: item.progress_seconds,
        progress_percentage: item.progress_percentage,
        last_watched_at: item.last_watched_at,
      }));
    } catch (error) {
      console.error('Error fetching resume watching videos:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, selectedProfile]);

  // Remove from resume watching
  const removeFromResume = useCallback(async (id: string) => {
    if (!user || !selectedProfile) return;

    try {
      const { error } = await supabase
        .from('watch_progress')
        .update({ completed: true })
        .eq('user_id', user.id)
        .eq('profile_id', selectedProfile.id)
        .eq('video_id', id);

      if (error) {
        console.error('Error removing from resume watching:', error);
        return;
      }

      // PostHog tracking
      posthog.capture('resume_watching:video_removed', {
        video_id: id,
        profile_id: selectedProfile.id,
        removal_method: 'manual'
      });
    } catch (error) {
      console.error('Error removing from resume watching:', error);
    }
  }, [user, selectedProfile, posthog]);

  // Load progress for current video
  useEffect(() => {
    if (videoId) {
      loadProgress(videoId).then(setProgress);
    }
  }, [videoId, loadProgress]);

  return {
    progress,
    loading,
    saveProgress,
    loadProgress,
    getResumeWatchingVideos,
    removeFromResume,
  };
};