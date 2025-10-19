import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  totalVideos: number;
  totalWatchTimeHours: number;
  avgCompletionRate: number;
  activeUsersToday: number;
  topCategory: { name: string; views: number } | null;
}

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Get total videos
      const { count: totalVideos } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true });

      // Get analytics summary
      const { data: analyticsData } = await supabase
        .from('video_analytics')
        .select('total_watch_time_seconds, completion_rate, views_today');

      const totalWatchTimeSeconds = analyticsData?.reduce(
        (sum, row) => sum + (row.total_watch_time_seconds || 0),
        0
      ) || 0;

      const avgCompletionRate =
        analyticsData && analyticsData.length > 0
          ? analyticsData.reduce((sum, row) => sum + (row.completion_rate || 0), 0) /
            analyticsData.length
          : 0;

      // Get active users today (distinct users with watch progress today)
      const { data: activeUsersData } = await supabase
        .from('watch_progress')
        .select('user_id')
        .gte('last_watched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const activeUsersToday = activeUsersData
        ? new Set(activeUsersData.map((row) => row.user_id)).size
        : 0;

      // Get top category by views
      const { data: categoryData } = await supabase
        .from('video_analytics')
        .select(`
          video:videos!inner (
            categories!inner (
              name
            )
          ),
          total_views
        `);

      let topCategory: { name: string; views: number } | null = null;
      if (categoryData) {
        const categoryViews = new Map<string, number>();
        categoryData.forEach((row: any) => {
          const categoryName = row.video?.categories?.name;
          if (categoryName) {
            categoryViews.set(
              categoryName,
              (categoryViews.get(categoryName) || 0) + row.total_views
            );
          }
        });

        if (categoryViews.size > 0) {
          const [name, views] = Array.from(categoryViews.entries()).sort(
            (a, b) => b[1] - a[1]
          )[0];
          topCategory = { name, views };
        }
      }

      return {
        totalVideos: totalVideos || 0,
        totalWatchTimeHours: Math.round(totalWatchTimeSeconds / 3600),
        avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
        activeUsersToday,
        topCategory,
      } as DashboardStats;
    },
  });
};
