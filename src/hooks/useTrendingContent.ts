import { useQuery } from '@tanstack/react-query';

/**
 * Trending content ranked by real play data, served by the PostHog `trending_content`
 * endpoint via the /api/trending serverless proxy. This is the "product data powers the
 * product" story: the carousel order comes straight from PostHog analytics.
 */
export interface TrendingItem {
  content_id: string;
  plays: number;
  unique_viewers: number;
}

export const useTrendingContent = (lookbackDays = 30, resultLimit = 10) => {
  return useQuery({
    queryKey: ['trending-content', lookbackDays, resultLimit],
    queryFn: async (): Promise<TrendingItem[]> => {
      const res = await fetch(
        `/api/trending?lookback_days=${lookbackDays}&result_limit=${resultLimit}`,
      );
      if (!res.ok) throw new Error(`Trending endpoint failed: ${res.status}`);
      const data = await res.json();
      return (data.items ?? []) as TrendingItem[];
    },
    staleTime: 1000 * 60 * 30, // matches the endpoint's 1h freshness, roughly
  });
};
