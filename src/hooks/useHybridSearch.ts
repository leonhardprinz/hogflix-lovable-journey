import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePostHog } from 'posthog-js/react';

interface SearchVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
}

interface SearchResult {
  videos: SearchVideo[];
  searchType: 'text' | 'ai' | 'hybrid';
  query: string;
}

export const useHybridSearch = () => {
  const [allVideos, setAllVideos] = useState<SearchVideo[]>([]);
  const [searchResults, setSearchResults] = useState<SearchVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchType, setLastSearchType] = useState<'text' | 'ai' | 'hybrid'>('text');
  const posthog = usePostHog();

  // Load all videos on mount for text search
  useEffect(() => {
    const fetchAllVideos = async () => {
      const { data: videos, error } = await supabase
        .from('videos')
        .select('id, title, description, thumbnail_url, video_url, duration');
      
      if (!error && videos) {
        setAllVideos(videos);
      }
    };

    fetchAllVideos();
  }, []);

  // Basic text search function
  const performTextSearch = useCallback((query: string): SearchVideo[] => {
    if (!query.trim()) return [];
    
    const searchTerm = query.toLowerCase();
    
    return allVideos.filter(video => 
      video.title.toLowerCase().includes(searchTerm) ||
      (video.description && video.description.toLowerCase().includes(searchTerm))
    ).slice(0, 6); // Limit to 6 results
  }, [allVideos]);

  // AI search function
  const performAISearch = useCallback(async (query: string): Promise<SearchVideo[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-search', {
        body: { query }
      });

      if (error) {
        console.error('AI search error:', error);
        return [];
      }

      return data?.videos || [];
    } catch (error) {
      console.error('AI search exception:', error);
      return [];
    }
  }, []);

  // Hybrid search function
  const search = useCallback(async (query: string): Promise<SearchResult> => {
    if (!query.trim()) {
      return { videos: [], searchType: 'text', query };
    }

    setIsSearching(true);

    try {
      // First, try basic text search
      const textResults = performTextSearch(query);
      
      // If text search returns good results (3+ matches), use those
      if (textResults.length >= 3) {
        setSearchResults(textResults);
        setLastSearchType('text');
        
        posthog.capture('search:text_search_used', {
          query,
          result_count: textResults.length
        });

        return { videos: textResults, searchType: 'text', query };
      }

      // If text search has few results, enhance with AI search
      const aiResults = await performAISearch(query);
      
      // Combine results, prioritizing text matches
      const combinedResults = [...textResults];
      
      // Add AI results that aren't already in text results
      aiResults.forEach(aiVideo => {
        if (!combinedResults.some(textVideo => textVideo.id === aiVideo.id)) {
          combinedResults.push(aiVideo);
        }
      });

      const finalResults = combinedResults.slice(0, 6);
      setSearchResults(finalResults);
      
      const searchType = textResults.length > 0 ? 'hybrid' : 'ai';
      setLastSearchType(searchType);

      posthog.capture('search:hybrid_search_used', {
        query,
        text_results: textResults.length,
        ai_results: aiResults.length,
        final_results: finalResults.length,
        search_type: searchType
      });

      return { videos: finalResults, searchType, query };
      
    } catch (error) {
      console.error('Search error:', error);
      
      // Fallback to text search only
      const fallbackResults = performTextSearch(query);
      setSearchResults(fallbackResults);
      setLastSearchType('text');
      
      return { videos: fallbackResults, searchType: 'text', query };
    } finally {
      setIsSearching(false);
    }
  }, [performTextSearch, performAISearch, posthog]);

  // Instant search for immediate feedback
  const instantSearch = useCallback((query: string): SearchVideo[] => {
    return performTextSearch(query);
  }, [performTextSearch]);

  return {
    search,
    instantSearch,
    searchResults,
    isSearching,
    lastSearchType,
    setSearchResults
  };
};