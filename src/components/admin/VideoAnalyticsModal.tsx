import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVideoAnalyticsById } from '@/hooks/useVideoAnalytics';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Clock, Eye, Users, Star, TrendingUp, BarChart3 } from 'lucide-react';

interface VideoAnalyticsModalProps {
  videoId: string | null;
  onClose: () => void;
}

export const VideoAnalyticsModal = ({ videoId, onClose }: VideoAnalyticsModalProps) => {
  const { data: analytics, isLoading } = useVideoAnalyticsById(videoId);

  if (!videoId) return null;

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Drop-off/Retention data
  const retentionData = [
    { milestone: 'Start', retention: 100, viewers: analytics?.started_count || 0 },
    { milestone: '25%', retention: analytics?.retention_at_25 || 0, viewers: Math.round((analytics?.started_count || 0) * ((analytics?.retention_at_25 || 0) / 100)) },
    { milestone: '50%', retention: analytics?.retention_at_50 || 0, viewers: Math.round((analytics?.started_count || 0) * ((analytics?.retention_at_50 || 0) / 100)) },
    { milestone: '75%', retention: analytics?.retention_at_75 || 0, viewers: Math.round((analytics?.started_count || 0) * ((analytics?.retention_at_75 || 0) / 100)) },
    { milestone: 'Complete', retention: analytics?.completion_rate || 0, viewers: analytics?.completed_count || 0 },
  ];

  // Rating distribution (mock data - would need actual rating breakdown)
  const ratingDistribution = [
    { rating: '5⭐', count: Math.round((analytics?.rating_count || 0) * 0.4) },
    { rating: '4⭐', count: Math.round((analytics?.rating_count || 0) * 0.3) },
    { rating: '3⭐', count: Math.round((analytics?.rating_count || 0) * 0.2) },
    { rating: '2⭐', count: Math.round((analytics?.rating_count || 0) * 0.08) },
    { rating: '1⭐', count: Math.round((analytics?.rating_count || 0) * 0.02) },
  ];

  return (
    <Dialog open={!!videoId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Video Analytics</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Video Overview */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-6">
                  <img
                    src={analytics.video?.thumbnail_url}
                    alt={analytics.video?.title}
                    className="w-48 h-27 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{analytics.video?.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {analytics.video?.categories?.name} • Duration:{' '}
                      {formatDuration(analytics.video?.duration || 0)}
                    </p>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">{analytics.total_views.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Total Views</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">{analytics.unique_viewers.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Unique Viewers</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">{analytics.completion_rate.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Completion Rate</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-2xl font-bold">{analytics.avg_rating.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">Avg Rating ({analytics.rating_count})</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Engagement Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Avg Watch Time</p>
                  </div>
                  <p className="text-2xl font-bold">{formatDuration(analytics.avg_watch_time_seconds)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Watchlist Adds</p>
                  </div>
                  <p className="text-2xl font-bold">{analytics.watchlist_count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Replays</p>
                  </div>
                  <p className="text-2xl font-bold">{analytics.replay_count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Views Today</p>
                  </div>
                  <p className="text-2xl font-bold">{analytics.views_today}</p>
                </CardContent>
              </Card>
            </div>

            {/* Retention Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Viewer Retention & Drop-off Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={retentionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="milestone" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'retention') return `${value.toFixed(1)}%`;
                        return value;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="retention"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                      name="Retention %"
                    />
                    <Line
                      type="monotone"
                      dataKey="viewers"
                      stroke="hsl(var(--secondary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--secondary))', r: 5 }}
                      name="# Viewers"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Rating Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ratingDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="rating" type="category" stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                      {ratingDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            index === 0
                              ? 'hsl(var(--chart-1))'
                              : index === 1
                              ? 'hsl(var(--chart-2))'
                              : index === 2
                              ? 'hsl(var(--chart-3))'
                              : index === 3
                              ? 'hsl(var(--chart-4))'
                              : 'hsl(var(--chart-5))'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No analytics data available for this video.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
