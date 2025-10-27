import { useState, useEffect, useCallback, useRef } from 'react';
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
  category_name?: string;
}

export const useWatchProgress = (videoId?: string) => {
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const posthog = usePostHog();
  const [progress, setProgress] = useState<WatchProgressData | null>(null);
  const [loading, setLoading] = useState(false);

  // Load existing progress for a video
  const loadProgress = useCallback(async (id: string) => {
    if (!user || !selectedProfile) {
      if (import.meta.env.DEV) {
        console.log('Skip loading progress - no user or profile');
      }
      return null;
    }

    if (import.meta.env.DEV) {
      console.log('Loading progress for video:', id);
    }

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

      if (import.meta.env.DEV) {
        console.log('Loaded progress data:', data);
      }
      return data;
    } catch (error) {
      console.error('Error loading progress:', error);
      return null;
    }
  }, [user, selectedProfile]);

  // Non-blocking progress save queue
  const progressSaveQueue = useRef<NodeJS.Timeout | null>(null);
  
  // Save or update progress with non-blocking queue
  const saveProgress = useCallback((
    id: string,
    currentTime: number,
    duration: number,
    sessionId: string
  ) => {
    // Validate conditions
    if (!user || !selectedProfile || currentTime < 3 || duration <= 0 || currentTime > duration) {
      return;
    }

    // Clear existing queued save to debounce rapid calls
    if (progressSaveQueue.current) {
      clearTimeout(progressSaveQueue.current);
    }

    // Queue the save operation to run after current execution stack
    progressSaveQueue.current = setTimeout(async () => {
      const progressPercentage = (currentTime / duration) * 100;
      const isCompleted = progressPercentage >= 90;
      const progressSeconds = Math.floor(currentTime);

      if (import.meta.env.DEV) {
        console.log('💾 Queued progress save:', {
          video_id: id,
          progress_seconds: progressSeconds,
          percentage: progressPercentage.toFixed(2) + '%'
        });
      }

      try {
        // Check for existing record first
        const { data: existingData } = await supabase
          .from('watch_progress')
          .select('id')
          .eq('user_id', user.id)
          .eq('profile_id', selectedProfile.id)
          .eq('video_id', id)
          .maybeSingle();

        const progressData = {
          user_id: user.id,
          profile_id: selectedProfile.id,
          video_id: id,
          progress_seconds: progressSeconds,
          duration_seconds: Math.floor(duration),
          progress_percentage: Number(progressPercentage.toFixed(2)),
          completed: isCompleted,
          session_id: sessionId,
          last_watched_at: new Date().toISOString(),
        };

        let error;
        if (existingData) {
          const { error: updateError } = await supabase
            .from('watch_progress')
            .update(progressData)
            .eq('id', existingData.id);
          error = updateError;
        } else {
          const { error: insertError } = await supabase
            .from('watch_progress')
            .insert(progressData);
          error = insertError;
        }

      if (!error) {
        if (import.meta.env.DEV) {
          console.log('✅ Progress saved');
        }
        // Don't update state during playback to avoid re-renders
        // setProgress(progressData); // REMOVED - prevents glitches
        
        // Track completion
        if (isCompleted) {
            posthog.capture('video:completed', {
              video_id: id,
              session_id: sessionId,
              profile_id: selectedProfile.id,
              total_duration: Math.floor(duration)
            });
          }
        } else {
          console.error('❌ Save error:', error);
        }
      } catch (error) {
        console.error('❌ Progress save failed:', error);
      }
    }, 100); // Small delay to debounce and make non-blocking
  }, [user, selectedProfile, posthog]);

  // Get videos with resume progress - improved query and lower threshold
  const getResumeWatchingVideos = useCallback(async (): Promise<VideoWithProgress[]> => {
    if (!user || !selectedProfile) {
      if (import.meta.env.DEV) {
        console.log('🚫 No user or profile for resume videos');
      }
      return [];
    }

    if (import.meta.env.DEV) {
      console.log('🔍 Fetching resume watching videos...');
    }
    setLoading(true);
    
    try {
      // Use a simpler direct JOIN query with lower thresholds and include category
      const { data, error } = await supabase
        .from('watch_progress')
        .select(`
          progress_seconds,
          progress_percentage,
          last_watched_at,
          videos (
            id,
            title,
            description,
            thumbnail_url,
            video_url,
            duration,
            categories!videos_category_id_fkey (
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('profile_id', selectedProfile.id)
        .eq('completed', false)
        .gte('progress_seconds', 5)  // At least 5 seconds watched
        .lte('progress_percentage', 95)  // Not completed
        .order('last_watched_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('❌ Error fetching resume videos:', error);
        return [];
      }

      if (import.meta.env.DEV) {
        console.log('📊 Resume videos query result:', data?.length || 0, 'videos');
        
        if (!data || data.length === 0) {
          console.log('ℹ️ No resume videos found - checking all progress records...');
          
          // Debug query to see what we have
          const { data: debugData } = await supabase
            .from('watch_progress')
            .select('progress_seconds, progress_percentage, completed')
            .eq('user_id', user.id)
            .eq('profile_id', selectedProfile.id)
            .order('last_watched_at', { ascending: false })
            .limit(5);
            
          console.log('🔍 Recent progress records:', debugData);
        }
      }

      // Transform the data properly
      const resumeVideos = (data || [])
        .filter(item => item.videos) // Ensure video data exists
        .map((item: any) => ({
          ...item.videos,
          progress_seconds: item.progress_seconds,
          progress_percentage: item.progress_percentage,
          last_watched_at: item.last_watched_at,
          category_name: item.videos?.categories?.name,
        }));

      if (import.meta.env.DEV) {
        console.log('✅ Returning', resumeVideos.length, 'resume videos');
      }
      return resumeVideos;
      
    } catch (error) {
      console.error('❌ Error in getResumeWatchingVideos:', error);
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