import { useQuery } from '@tanstack/react-query';
import { usePostHog } from 'posthog-js/react';

/**
 * The logged-in viewer's watch summary, served by the PostHog `viewer_stats` endpoint via
 * the /api/viewer-stats serverless proxy. We pass the user's own posthog distinct_id.
 *
 * Demo fallback: if the current user has no watch history yet, we fall back to the seeded
 * `hf-demo-viewer` (the endpoint default) so the panel always shows compelling numbers.
 * `isDemoData` flags that fallback so the UI can label it.
 */
export interface ViewingStats {
  plays: number;
  completions: number;
  watch_hours: number | null;
  top_genre: string | null;
  isDemoData: boolean;
}

const EMPTY: Omit<ViewingStats, 'isDemoData'> = {
  plays: 0,
  completions: 0,
  watch_hours: 0,
  top_genre: null,
};

async function fetchStats(
  distinctId: string | undefined,
  lookbackDays: number,
): Promise<Omit<ViewingStats, 'isDemoData'> | null> {
  const params = new URLSearchParams({ lookback_days: String(lookbackDays) });
  if (distinctId) params.set('distinct_id', distinctId);
  const res = await fetch(`/api/viewer-stats?${params.toString()}`);
  if (!res.ok) throw new Error(`Viewer-stats endpoint failed: ${res.status}`);
  return res.json();
}

export const useViewingStats = (lookbackDays = 30) => {
  const posthog = usePostHog();
  const distinctId = posthog?.get_distinct_id?.();

  return useQuery({
    queryKey: ['viewing-stats', distinctId, lookbackDays],
    enabled: !!distinctId,
    queryFn: async (): Promise<ViewingStats> => {
      const real = await fetchStats(distinctId, lookbackDays);
      if (real && ((real.plays ?? 0) > 0 || (real.completions ?? 0) > 0)) {
        return { ...real, isDemoData: false };
      }
      // No real history yet — show the seeded demo viewer instead.
      const demo = await fetchStats(undefined, lookbackDays);
      return { ...(demo ?? EMPTY), isDemoData: true };
    },
    staleTime: 1000 * 60,
  });
};
