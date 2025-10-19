import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VideoAnalytics {
  video_id: string;
  total_views: number;
  unique_viewers: number;
  total_watch_time_seconds: number;
  avg_watch_time_seconds: number;
  completion_rate: number;
  completed_count: number;
  started_count: number;
  retention_at_25: number;
  retention_at_50: number;
  retention_at_75: number;
  avg_rating: number;
  rating_count: number;
  watchlist_count: number;
  replay_count: number;
  views_today: number;
  views_this_week: number;
  views_this_month: number;
  last_calculated_at: string;
  video?: {
    id: string;
    title: string;
    thumbnail_url: string;
    duration: number;
    category_id: string;
    categories?: {
      name: string;
    };
  };
}

export const useVideoAnalytics = () => {
  return useQuery({
    queryKey: ['video-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_analytics')
        .select(`
          *,
          video:videos!inner (
            id,
            title,
            thumbnail_url,
            duration,
            category_id,
            categories!inner (
              name
            )
          )
        `)
        .order('total_views', { ascending: false });

      if (error) throw error;
      return data as VideoAnalytics[];
    },
  });
};

export const useVideoAnalyticsById = (videoId: string | null) => {
  return useQuery({
    queryKey: ['video-analytics', videoId],
    queryFn: async () => {
      if (!videoId) return null;
      
      const { data, error } = await supabase
        .from('video_analytics')
        .select(`
          *,
          video:videos!inner (
            id,
            title,
            description,
            thumbnail_url,
            duration,
            category_id,
            categories!inner (
              name
            )
          )
        `)
        .eq('video_id', videoId)
        .single();

      if (error) throw error;
      return data as VideoAnalytics;
    },
    enabled: !!videoId,
  });
};

export const useRefreshAnalytics = () => {
  return async () => {
    const { error } = await supabase.rpc('refresh_video_analytics');
    if (error) throw error;
  };
};
