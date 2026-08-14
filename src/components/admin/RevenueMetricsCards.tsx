import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, CreditCard, Users, TrendingUp } from 'lucide-react';
import { useRevenueMetrics } from '@/hooks/useRevenueMetrics';

/**
 * Revenue snapshot row for the Admin dashboard, powered by the PostHog `revenue_summary`
 * endpoint (over the Stripe data warehouse) via /api/revenue. Matches the styling of the
 * existing dashboard stat cards.
 */
const money = (v: unknown) =>
  `$${Number(v ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const RevenueMetricsCards = () => {
  const { data, isLoading, isError } = useRevenueMetrics();

  if (isError) return null;

  const cards = [
    { title: 'Total Revenue', value: money(data?.total_revenue), icon: DollarSign },
    {
      title: 'Active Subscriptions',
      value: (data?.active_subscriptions ?? 0).toLocaleString(),
      icon: CreditCard,
    },
    {
      title: 'Paying Customers',
      value: (data?.paying_customers ?? 0).toLocaleString(),
      icon: Users,
    },
    { title: 'Avg Revenue / Customer', value: money(data?.avg_revenue_per_customer), icon: TrendingUp },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Revenue · live from PostHog (Stripe warehouse)
      </h3>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="bg-card-background border-gray-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-text-secondary">
                      {card.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-text-secondary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-text-primary truncate">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
};
