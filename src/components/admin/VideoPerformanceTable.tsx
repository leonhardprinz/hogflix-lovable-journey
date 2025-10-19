import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VideoAnalytics } from '@/hooks/useVideoAnalytics';
import { Search, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VideoPerformanceTableProps {
  data: VideoAnalytics[];
  onVideoClick: (videoId: string) => void;
}

type SortField = 'title' | 'views' | 'completion_rate' | 'avg_rating' | 'category';
type SortOrder = 'asc' | 'desc';

export const VideoPerformanceTable = ({
  data,
  onVideoClick,
}: VideoPerformanceTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('views');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedData = data
    .filter((video) => {
      const title = video.video?.title?.toLowerCase() || '';
      const category = video.video?.categories?.name?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return title.includes(search) || category.includes(search);
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'title':
          aValue = a.video?.title || '';
          bValue = b.video?.title || '';
          break;
        case 'views':
          aValue = a.total_views;
          bValue = b.total_views;
          break;
        case 'completion_rate':
          aValue = a.completion_rate;
          bValue = b.completion_rate;
          break;
        case 'avg_rating':
          aValue = a.avg_rating;
          bValue = b.avg_rating;
          break;
        case 'category':
          aValue = a.video?.categories?.name || '';
          bValue = b.video?.categories?.name || '';
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos by title or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-2 hover:bg-transparent"
                >
                  Video
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('category')}
                  className="flex items-center gap-2 hover:bg-transparent"
                >
                  Category
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('views')}
                  className="flex items-center gap-2 hover:bg-transparent ml-auto"
                >
                  Views
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Unique Viewers</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('completion_rate')}
                  className="flex items-center gap-2 hover:bg-transparent ml-auto"
                >
                  Completion Rate
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Avg Watch Time</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('avg_rating')}
                  className="flex items-center gap-2 hover:bg-transparent ml-auto"
                >
                  Rating
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Watchlist</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No videos found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((video) => (
                <TableRow
                  key={video.video_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onVideoClick(video.video_id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={video.video?.thumbnail_url}
                        alt={video.video?.title}
                        className="w-16 h-9 object-cover rounded"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium line-clamp-1">
                          {video.video?.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(video.last_calculated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{video.video?.categories?.name || 'N/A'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {video.total_views.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {video.unique_viewers.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        video.completion_rate >= 70
                          ? 'text-green-600 dark:text-green-400'
                          : video.completion_rate >= 40
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {video.completion_rate.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatDuration(video.avg_watch_time_seconds)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      ⭐ {video.avg_rating.toFixed(1)}
                      <span className="text-xs text-muted-foreground">
                        ({video.rating_count})
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{video.watchlist_count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
