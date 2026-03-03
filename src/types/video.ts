/**
 * Shared Video interface used across pages and components.
 */
export interface Video {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string;
    video_url: string;
    duration: number;
    category_id?: string;
    ai_summary?: string | null;
    average_rating?: number;
    rating_count?: number;
    created_at?: string;
}
