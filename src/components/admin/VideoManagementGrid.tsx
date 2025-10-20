import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useVideoManagement } from '@/hooks/useVideoManagement';
import { useVideoTags } from '@/hooks/useVideoTags';
import { supabase } from '@/integrations/supabase/client';
import { BulkActionToolbar } from './BulkActionToolbar';
import { Grid3x3, List, Plus, Pencil, Trash2, BarChart3, ExternalLink } from 'lucide-react';
import { videoHrefFor } from '@/lib/videoRouting';

interface Category {
  id: string;
  name: string;
}

export function VideoManagementGrid() {
  const {
    videos,
    loading,
    selectedIds,
    setSelectedIds,
    fetchVideos,
    deleteVideo,
    bulkUpdateVideos,
    bulkDelete,
  } = useVideoManagement();

  const { tags, bulkAddTags, bulkRemoveTags } = useVideoTags();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState({
    categoryId: null as string | null,
    tagIds: [] as string[],
    isPublic: null as boolean | null,
    searchQuery: '',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      setCategories(data || []);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchVideos(filters);
  }, [filters, fetchVideos]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === videos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(videos.map(v => v.id)));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteVideo(id);
    setDeleteConfirmId(null);
    fetchVideos(filters);
  };

  const handleBulkUpdateCategory = async (categoryId: string) => {
    if (selectedIds.size === 0) return;
    await bulkUpdateVideos(Array.from(selectedIds), { category_id: categoryId });
    setSelectedIds(new Set());
    fetchVideos(filters);
  };

  const handleBulkPublish = async (isPublic: boolean) => {
    if (selectedIds.size === 0) return;
    await bulkUpdateVideos(Array.from(selectedIds), { is_public: isPublic });
    setSelectedIds(new Set());
    fetchVideos(filters);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    await bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    fetchVideos(filters);
  };

  const handleBulkAddTags = async (tagIds: string[]) => {
    if (selectedIds.size === 0 || tagIds.length === 0) return;
    await bulkAddTags(Array.from(selectedIds), tagIds);
    fetchVideos(filters);
  };

  const handleBulkRemoveTags = async (tagIds: string[]) => {
    if (selectedIds.size === 0 || tagIds.length === 0) return;
    await bulkRemoveTags(Array.from(selectedIds), tagIds);
    fetchVideos(filters);
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="gap-2"
          >
            <Grid3x3 className="h-4 w-4" /> Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <List className="h-4 w-4" /> List
          </Button>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Video
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <Select
          value={filters.categoryId || 'all'}
          onValueChange={val => setFilters({ ...filters, categoryId: val === 'all' ? null : val })}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.isPublic === null ? 'all' : filters.isPublic ? 'published' : 'draft'}
          onValueChange={val =>
            setFilters({
              ...filters,
              isPublic: val === 'all' ? null : val === 'published',
            })
          }
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search videos..."
          value={filters.searchQuery}
          onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
          className="flex-1 min-w-[200px]"
        />
      </div>

      {/* Select All */}
      {videos.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.size === videos.length && videos.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-text-secondary">
            Select all ({videos.length})
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-4'}>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className={viewMode === 'grid' ? 'h-64' : 'h-24'} />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-text-secondary mb-4">No videos found.</p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Create your first video
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map(video => (
            <Card key={video.id} className="overflow-hidden group relative">
              <div className="absolute top-2 left-2 z-10">
                <Checkbox
                  checked={selectedIds.has(video.id)}
                  onCheckedChange={() => toggleSelect(video.id)}
                  className="bg-background-dark/80"
                />
              </div>
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-full h-40 object-cover"
              />
              <div className="p-3 space-y-2">
                <h3 className="font-semibold text-text-primary truncate">{video.title}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant={video.is_public ? 'default' : 'secondary'} className="text-xs">
                    {video.is_public ? 'Published' : 'Draft'}
                  </Badge>
                  <span className="text-xs text-text-secondary">{formatDuration(video.duration)}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-8 px-2">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => setDeleteConfirmId(video.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => window.open(videoHrefFor(video.categories?.name, video.id), '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {videos.map(video => (
            <Card key={video.id} className="p-4 flex items-center gap-4 hover:bg-card-background/80 transition-colors">
              <Checkbox
                checked={selectedIds.has(video.id)}
                onCheckedChange={() => toggleSelect(video.id)}
              />
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-24 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary">{video.title}</h3>
                <p className="text-sm text-text-secondary">
                  {video.categories?.name} • {formatDuration(video.duration)}
                </p>
              </div>
              <Badge variant={video.is_public ? 'default' : 'secondary'}>
                {video.is_public ? 'Published' : 'Draft'}
              </Badge>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteConfirmId(video.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(videoHrefFor(video.categories?.name, video.id), '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          categories={categories}
          tags={tags}
          onBulkUpdateCategory={handleBulkUpdateCategory}
          onBulkAddTags={handleBulkAddTags}
          onBulkRemoveTags={handleBulkRemoveTags}
          onBulkPublish={handleBulkPublish}
          onBulkDelete={() => setShowBulkDeleteConfirm(true)}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this video? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Delete Videos</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} video(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
