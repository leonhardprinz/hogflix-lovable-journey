import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { toast } from 'sonner';

interface WatchlistContextType {
  watchlist: string[];
  isInWatchlist: (videoId: string) => boolean;
  addToWatchlist: (videoId: string) => Promise<void>;
  removeFromWatchlist: (videoId: string) => Promise<void>;
  loading: boolean;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};

interface WatchlistProviderProps {
  children: ReactNode;
}

export const WatchlistProvider = ({ children }: WatchlistProviderProps) => {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { selectedProfile } = useProfile();

  // Load user's watchlist
  const loadWatchlist = async () => {
    if (!user || !selectedProfile) {
      setWatchlist([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_watchlist')
        .select('video_id')
        .eq('user_id', user.id)
        .eq('profile_id', selectedProfile.id);

      if (error) throw error;

      setWatchlist(data.map(item => item.video_id));
    } catch (error) {
      console.error('Error loading watchlist:', error);
      toast.error('Failed to load your watchlist');
    } finally {
      setLoading(false);
    }
  };

  // Load watchlist when user or profile changes
  useEffect(() => {
    loadWatchlist();
  }, [user, selectedProfile]);

  const isInWatchlist = (videoId: string) => {
    return watchlist.includes(videoId);
  };

  const addToWatchlist = async (videoId: string) => {
    if (!user || !selectedProfile) {
      toast.error('Please select a profile first');
      return;
    }

    if (isInWatchlist(videoId)) {
      return;
    }

    // Optimistic update
    setWatchlist(prev => [...prev, videoId]);

    try {
      const { error } = await supabase
        .from('user_watchlist')
        .insert({
          user_id: user.id,
          profile_id: selectedProfile.id,
          video_id: videoId
        });

      if (error) throw error;

      toast.success('Added to My List');
    } catch (error) {
      // Revert optimistic update
      setWatchlist(prev => prev.filter(id => id !== videoId));
      console.error('Error adding to watchlist:', error);
      toast.error('Failed to add to My List');
    }
  };

  const removeFromWatchlist = async (videoId: string) => {
    if (!user || !selectedProfile) {
      return;
    }

    // Optimistic update
    setWatchlist(prev => prev.filter(id => id !== videoId));

    try {
      const { error } = await supabase
        .from('user_watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('profile_id', selectedProfile.id)
        .eq('video_id', videoId);

      if (error) throw error;

      toast.success('Removed from My List');
    } catch (error) {
      // Revert optimistic update
      setWatchlist(prev => [...prev, videoId]);
      console.error('Error removing from watchlist:', error);
      toast.error('Failed to remove from My List');
    }
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        isInWatchlist,
        addToWatchlist,
        removeFromWatchlist,
        loading
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};