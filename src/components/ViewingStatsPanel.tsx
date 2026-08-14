import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { useViewingStats } from '@/hooks/useViewingStats';

/**
 * "Your viewing stats" panel, powered by the PostHog `viewer_stats` endpoint via
 * /api/viewer-stats. Shows the signed-in viewer's watch summary (or the seeded demo
 * viewer if they have no history yet — flagged with a "Sample data" badge).
 */
export const ViewingStatsPanel = () => {
  const { data, isLoading, isError } = useViewingStats(30);

  // Fail quiet — a missing key or endpoint shouldn't break the page.
  if (isError) return null;

  const cards = [
    { label: 'Videos started', value: data ? data.plays.toLocaleString() : '0', icon: Play },
    { label: 'Completed', value: data ? data.completions.toLocaleString() : '0', icon: CheckCircle2 },
    { label: 'Watch time', value: `${data?.watch_hours ?? 0}h`, icon: Clock },
    { label: 'Top genre', value: data?.top_genre ?? '—', icon: Sparkles },
  ];

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold">Your viewing stats</h2>
        <span className="text-xs text-muted-foreground">Last 30 days · via PostHog</span>
        {data?.isDemoData && <Badge variant="secondary">Sample data</Badge>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{card.label}</span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold truncate">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
};
