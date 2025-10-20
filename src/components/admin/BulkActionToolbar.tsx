import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tag, FolderOpen, Eye, Trash2, X } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  categories: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string; color: string }>;
  onBulkUpdateCategory: (categoryId: string) => void;
  onBulkAddTags: (tagIds: string[]) => void;
  onBulkRemoveTags: (tagIds: string[]) => void;
  onBulkPublish: (isPublic: boolean) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  categories,
  tags,
  onBulkUpdateCategory,
  onBulkAddTags,
  onBulkRemoveTags,
  onBulkPublish,
  onBulkDelete,
  onClearSelection,
}: BulkActionToolbarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card-background border border-primary-red shadow-2xl rounded-lg px-6 py-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-8">
      <span className="font-medium text-text-primary">
        {selectedCount} video{selectedCount !== 1 ? 's' : ''} selected
      </span>

      <Separator orientation="vertical" className="h-8" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Tag className="h-4 w-4" /> Tags
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          <DropdownMenuItem onClick={() => {
            const selectedTags = prompt('Enter tag IDs separated by commas:');
            if (selectedTags) {
              onBulkAddTags(selectedTags.split(',').map(id => id.trim()));
            }
          }}>
            Add Tags
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            const selectedTags = prompt('Enter tag IDs to remove, separated by commas:');
            if (selectedTags) {
              onBulkRemoveTags(selectedTags.split(',').map(id => id.trim()));
            }
          }}>
            Remove Tags
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FolderOpen className="h-4 w-4" /> Category
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56 max-h-64 overflow-y-auto">
          {categories.map(cat => (
            <DropdownMenuItem key={cat.id} onClick={() => onBulkUpdateCategory(cat.id)}>
              {cat.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="h-4 w-4" /> Visibility
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={() => onBulkPublish(true)}>
            Publish
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onBulkPublish(false)}>
            Unpublish
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="destructive" size="sm" onClick={onBulkDelete} className="gap-2">
        <Trash2 className="h-4 w-4" /> Delete
      </Button>

      <Separator orientation="vertical" className="h-8" />

      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
