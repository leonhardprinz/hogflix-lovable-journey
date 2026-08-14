import { useQuery } from '@tanstack/react-query';

/**
 * HogFlix revenue snapshot from the Stripe data warehouse, served by the PostHog
 * `revenue_summary` endpoint via the /api/revenue serverless proxy.
 */
export interface RevenueMetrics {
  active_subscriptions: number;
  total_revenue: number;
  paying_customers: number;
  avg_revenue_per_customer: number;
}

export const useRevenueMetrics = () => {
  return useQuery({
    queryKey: ['revenue-metrics'],
    queryFn: async (): Promise<RevenueMetrics | null> => {
      const res = await fetch('/api/revenue');
      if (!res.ok) throw new Error(`Revenue endpoint failed: ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });
};
