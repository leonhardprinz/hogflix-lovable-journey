import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import posthog from 'posthog-js';

interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  usage_count?: number;
}

export function useVideoTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const { data: tagsData, error } = await supabase
        .from('video_tags')
        .select('*')
        .order('name');

      if (error) throw error;

      // Get usage count for each tag
      const tagsWithCount = await Promise.all(
        (tagsData || []).map(async (tag) => {
          const { count } = await supabase
            .from('video_tag_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('tag_id', tag.id);
          
          return { ...tag, usage_count: count || 0 };
        })
      );

      setTags(tagsWithCount);
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(async (name: string, color: string) => {
    try {
      const { data, error } = await supabase
        .from('video_tags')
        .insert({ name, color })
        .select()
        .single();

      if (error) throw error;

      posthog.capture('admin:tag_created', { tag_id: data.id, tag_name: name });
      toast.success('Tag created successfully');
      await fetchTags();
      return { data, error: null };
    } catch (error: any) {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
      return { data: null, error };
    }
  }, [fetchTags]);

  const updateTag = useCallback(async (id: string, updates: { name?: string; color?: string }) => {
    try {
      const { data, error } = await supabase
        .from('video_tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      posthog.capture('admin:tag_updated', { tag_id: id, changes: Object.keys(updates) });
      toast.success('Tag updated successfully');
      await fetchTags();
      return { data, error: null };
    } catch (error: any) {
      console.error('Error updating tag:', error);
      toast.error('Failed to update tag');
      return { data: null, error };
    }
  }, [fetchTags]);

  const deleteTag = useCallback(async (id: string) => {
    try {
      // First, remove all assignments
      await supabase.from('video_tag_assignments').delete().eq('tag_id', id);

      // Then delete the tag
      const { error } = await supabase.from('video_tags').delete().eq('id', id);
      if (error) throw error;

      posthog.capture('admin:tag_deleted', { tag_id: id });
      toast.success('Tag deleted successfully');
      await fetchTags();
      return { error: null };
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag');
      return { error };
    }
  }, [fetchTags]);

  const assignTagsToVideo = useCallback(async (videoId: string, tagIds: string[]) => {
    try {
      // Remove existing assignments
      await supabase.from('video_tag_assignments').delete().eq('video_id', videoId);

      // Add new assignments
      if (tagIds.length > 0) {
        const assignments = tagIds.map(tagId => ({ video_id: videoId, tag_id: tagId }));
        const { error } = await supabase.from('video_tag_assignments').insert(assignments);
        if (error) throw error;
      }

      return { error: null };
    } catch (error: any) {
      console.error('Error assigning tags:', error);
      return { error };
    }
  }, []);

  const bulkAddTags = useCallback(async (videoIds: string[], tagIds: string[]) => {
    try {
      const assignments = videoIds.flatMap(videoId =>
        tagIds.map(tagId => ({ video_id: videoId, tag_id: tagId }))
      );

      const { error } = await supabase
        .from('video_tag_assignments')
        .upsert(assignments, { onConflict: 'video_id,tag_id', ignoreDuplicates: true });

      if (error) throw error;

      posthog.capture('admin:bulk_tag_add', { 
        video_count: videoIds.length, 
        tag_count: tagIds.length 
      });
      toast.success(`Tags added to ${videoIds.length} videos`);
      return { error: null };
    } catch (error: any) {
      console.error('Error bulk adding tags:', error);
      toast.error('Failed to add tags');
      return { error };
    }
  }, []);

  const bulkRemoveTags = useCallback(async (videoIds: string[], tagIds: string[]) => {
    try {
      const { error } = await supabase
        .from('video_tag_assignments')
        .delete()
        .in('video_id', videoIds)
        .in('tag_id', tagIds);

      if (error) throw error;

      posthog.capture('admin:bulk_tag_remove', { 
        video_count: videoIds.length, 
        tag_count: tagIds.length 
      });
      toast.success(`Tags removed from ${videoIds.length} videos`);
      return { error: null };
    } catch (error: any) {
      console.error('Error bulk removing tags:', error);
      toast.error('Failed to remove tags');
      return { error };
    }
  }, []);

  return {
    tags,
    loading,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    assignTagsToVideo,
    bulkAddTags,
    bulkRemoveTags,
  };
}
