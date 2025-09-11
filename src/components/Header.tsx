import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, ChevronDown, LogOut, Search, Play, Info } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface AISearchVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
}

const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AISearchVideo[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile } = useProfile();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-search', {
        body: { query: searchQuery }
      });

      if (error) {
        console.error('AI search error:', error);
        return;
      }

      const videos = data?.videos || [];
      setSearchResults(videos);
      setShowSearchResults(true);
      
      // Fire PostHog analytics event
      posthog.capture('ai_search:queried', {
        search_query: searchQuery,
        result_count: videos.length
      });
      
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAISearch();
    }
  };

  useEffect(() => {
    // Get current session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch role when user changes
  useEffect(() => {
    const fetchRole = async () => {
      if (user) {
        const { data, error } = await (supabase as any).rpc('get_user_role');
        if (!error) setRole(data as string);
      } else {
        setRole(null);
      }
    };
    fetchRole();
  }, [user]);

  const handleLogout = async () => {
    setLoading(true);

    try {
      // PostHog analytics for logout
      posthog.capture('user:logged_out');
      posthog.reset();

      // Supabase logout
      await supabase.auth.signOut();

      // Redirect to home page
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="w-full bg-background-dark/95 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="container-netflix flex items-center justify-between py-4">
          {/* Logo */}
          <Link to={user ? '/browse' : '/'}>
            <h1 className="text-3xl font-bold text-primary-red cursor-pointer font-manrope hover:opacity-80 transition-opacity">
              HogFlix
            </h1>
          </Link>

          <nav className="flex items-center space-x-6">
            {user ? (
              <>
                {/* Navigation Links */}
                  <div className="hidden lg:flex items-center space-x-6">
                    <Link 
                      to="/browse" 
                      className="text-text-primary hover:text-white font-manrope font-medium transition-colors"
                    >
                      Home
                    </Link>
                    <Link 
                      to="/my-list" 
                      className="text-text-primary hover:text-white font-manrope font-medium transition-colors"
                    >
                      My List
                    </Link>
                    <Link 
                      to="/support" 
                      className="text-text-primary hover:text-white font-manrope font-medium transition-colors"
                    >
                      Support
                    </Link>
                    {(role === 'admin' || role === 'moderator') && (
                      <Link 
                        to="/admin" 
                        className="text-text-primary hover:text-white font-manrope font-medium transition-colors"
                      >
                        Admin
                      </Link>
                    )}
                  </div>

                {/* AI Search Input */}
                <div className="relative flex-1 max-w-md mx-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Ask for a movie recommendation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="pl-10 bg-background/20 border-gray-700 text-text-primary placeholder:text-muted-foreground focus:border-primary-red"
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-red"></div>
                    </div>
                  )}
                </div>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex items-center space-x-2 text-text-primary hover:text-white hover:bg-white/10"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary-red rounded flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-manrope hidden sm:block">
                          {selectedProfile?.display_name || selectedProfile?.email?.split('@')[0] || 'User'}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-56 bg-background-dark border-gray-700 z-50"
                  >
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      disabled={loading}
                      className="text-text-primary hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {loading ? 'Logging out...' : 'Log Out'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              /* Unauthenticated Navigation */
              <Link to="/login">
                <Button 
                  variant="ghost" 
                  className="text-text-primary hover:text-primary-red font-manrope"
                >
                  Sign In
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* AI Search Results Modal */}
      <Dialog open={showSearchResults} onOpenChange={setShowSearchResults}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-background-dark border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-text-primary font-manrope">
              AI Search Results for "{searchQuery}"
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((video) => (
                  <div
                    key={video.id}
                    className="bg-card-background rounded-lg overflow-hidden hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      navigate(`/watch/${video.id}`);
                      setShowSearchResults(false);
                    }}
                  >
                    <div className="aspect-video bg-gray-700 relative overflow-hidden">
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Play className="h-12 w-12 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-text-primary font-manrope font-medium mb-2">
                        {video.title}
                      </h3>
                      {video.description && (
                        <p className="text-text-secondary text-sm font-manrope mb-2 line-clamp-2">
                          {video.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-text-tertiary text-sm font-manrope">
                          {formatDuration(video.duration)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-text-primary hover:text-white hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/watch/${video.id}`);
                            setShowSearchResults(false);
                          }}
                        >
                          <Info className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-text-secondary font-manrope">
                  No movies found for your search. Try a different query!
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Header;