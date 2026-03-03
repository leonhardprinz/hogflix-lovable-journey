import { supabase } from '@/integrations/supabase/client';

export interface VideoRating {
    video_id: string;
    avg_rating: number;
    rating_count: number;
}

/**
 * Fetch ratings for multiple videos in a single RPC call.
 * Falls back to per-video RPCs if the batch function doesn't exist yet.
 *
 * Returns a Map<video_id, { avg_rating, rating_count }> for O(1) lookups.
 */
export async function fetchVideoRatingsBatch(
    videoIds: string[]
): Promise<Map<string, { avg_rating: number; rating_count: number }>> {
    const ratingsMap = new Map<string, { avg_rating: number; rating_count: number }>();

    if (videoIds.length === 0) return ratingsMap;

    // Try the batch RPC first
    // Note: 'get_video_ratings_batch' may not be in Supabase generated types yet — use `as any`
    const { data, error } = await (supabase.rpc as any)('get_video_ratings_batch', {
        video_ids: videoIds,
    });

    if (!error && data) {
        for (const row of data as unknown as VideoRating[]) {
            ratingsMap.set(row.video_id, {
                avg_rating: Number(row.avg_rating) || 0,
                rating_count: Number(row.rating_count) || 0,
            });
        }
        // Fill in videos with no ratings
        for (const id of videoIds) {
            if (!ratingsMap.has(id)) {
                ratingsMap.set(id, { avg_rating: 0, rating_count: 0 });
            }
        }
        return ratingsMap;
    }

    // Fallback: per-video RPCs (graceful degradation)
    if (import.meta.env.DEV) {
        console.warn('Batch ratings RPC not available, falling back to per-video calls');
    }
    await Promise.all(
        videoIds.map(async (id) => {
            const [{ data: avgRating }, { data: ratingCount }] = await Promise.all([
                supabase.rpc('get_video_average_rating', { video_id_param: id }),
                supabase.rpc('get_video_rating_count', { video_id_param: id }),
            ]);
            ratingsMap.set(id, {
                avg_rating: Number(avgRating) || 0,
                rating_count: Number(ratingCount) || 0,
            });
        })
    );

    return ratingsMap;
}
