import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import posthog from 'posthog-js';

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  category_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  slug: string | null;
  categories?: { id: string; name: string };
  video_tag_assignments?: Array<{ video_tags: { id: string; name: string; color: string } }>;
}

interface Filters {
  categoryId: string | null;
  tagIds: string[];
  isPublic: boolean | null;
  searchQuery: string;
}

export function useVideoManagement() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchVideos = useCallback(async (filters: Filters) => {
    setLoading(true);
    try {
      let query = supabase
        .from('videos')
        .select(`
          *,
          categories!videos_category_id_fkey(id, name),
          video_tag_assignments(video_tags(id, name, color))
        `)
        .order('created_at', { ascending: false });

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters.isPublic !== null) {
        query = query.eq('is_public', filters.isPublic);
      }
      if (filters.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by tags if needed
      let filteredData = data || [];
      if (filters.tagIds.length > 0) {
        filteredData = filteredData.filter(video => {
          const videoTagIds = video.video_tag_assignments?.map((vta: any) => vta.video_tags.id) || [];
          return filters.tagIds.some(tagId => videoTagIds.includes(tagId));
        });
      }

      setVideos(filteredData as Video[]);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  }, []);

  const createVideo = useCallback(async (videoData: any) => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .insert([videoData])
        .select()
        .single();

      if (error) throw error;

      const user = await supabase.auth.getUser();
      posthog.capture('admin:video_created', { 
        video_id: data.id, 
        title: data.title,
        category_id: data.category_id 
      });

      await supabase.from('admin_activity_log').insert({
        admin_user_id: user.data.user?.id,
        action_type: 'video_created',
        entity_type: 'video',
        entity_id: data.id,
        details: { title: data.title }
      });

      toast.success('Video created successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('Error creating video:', error);
      toast.error('Failed to create video');
      return { data: null, error };
    }
  }, []);

  const updateVideo = useCallback(async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const user = await supabase.auth.getUser();
      posthog.capture('admin:video_updated', { 
        video_id: id, 
        changed_fields: Object.keys(updates) 
      });

      await supabase.from('admin_activity_log').insert({
        admin_user_id: user.data.user?.id,
        action_type: 'video_updated',
        entity_type: 'video',
        entity_id: id,
        details: { changed_fields: Object.keys(updates) }
      });

      toast.success('Video updated successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('Error updating video:', error);
      toast.error('Failed to update video');
      return { data: null, error };
    }
  }, []);

  const deleteVideo = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('videos').delete().eq('id', id);
      if (error) throw error;

      const user = await supabase.auth.getUser();
      posthog.capture('admin:video_deleted', { video_id: id });

      await supabase.from('admin_activity_log').insert({
        admin_user_id: user.data.user?.id,
        action_type: 'video_deleted',
        entity_type: 'video',
        entity_id: id,
        details: {}
      });

      toast.success('Video deleted successfully');
      return { error: null };
    } catch (error: any) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
      return { error };
    }
  }, []);

  const bulkUpdateVideos = useCallback(async (videoIds: string[], updates: any) => {
    try {
      const { data, error } = await supabase.rpc('bulk_update_videos', {
        video_ids: videoIds,
        updates: updates
      });

      if (error) throw error;

      posthog.capture('admin:bulk_update', { 
        count: videoIds.length, 
        changes: Object.keys(updates) 
      });

      toast.success(`${videoIds.length} videos updated successfully`);
      return { data, error: null };
    } catch (error: any) {
      console.error('Error bulk updating videos:', error);
      toast.error('Failed to bulk update videos');
      return { data: null, error };
    }
  }, []);

  const bulkDelete = useCallback(async (videoIds: string[]) => {
    try {
      const { error } = await supabase.from('videos').delete().in('id', videoIds);
      if (error) throw error;

      const user = await supabase.auth.getUser();
      posthog.capture('admin:bulk_delete', { count: videoIds.length });

      await supabase.from('admin_activity_log').insert({
        admin_user_id: user.data.user?.id,
        action_type: 'bulk_delete',
        entity_type: 'video',
        details: { count: videoIds.length }
      });

      toast.success(`${videoIds.length} videos deleted successfully`);
      return { error: null };
    } catch (error: any) {
      console.error('Error bulk deleting videos:', error);
      toast.error('Failed to bulk delete videos');
      return { error };
    }
  }, []);

  return {
    videos,
    loading,
    selectedIds,
    setSelectedIds,
    fetchVideos,
    createVideo,
    updateVideo,
    deleteVideo,
    bulkUpdateVideos,
    bulkDelete,
  };
}
