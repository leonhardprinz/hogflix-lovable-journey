import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useHybridSearch } from '@/hooks/useHybridSearch';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { User, ChevronDown, LogOut, Search, Play, Info, CreditCard, Sparkles, Check, Users, Mail } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface Profile {
  id: string;
  display_name: string;
  is_kids_profile: boolean;
}

const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showInstantResults, setShowInstantResults] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Profile[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Use hybrid search hook
  const { search, instantSearch, searchResults, isSearching, lastSearchType } = useHybridSearch();
  
  // Instant search results for dropdown preview
  const instantResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return instantSearch(searchQuery);
  }, [searchQuery, instantSearch]);

  // Handle click outside to close instant results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowInstantResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show instant results when user types
  useEffect(() => {
    if (searchQuery.trim() && instantResults.length > 0) {
      setShowInstantResults(true);
    } else {
      setShowInstantResults(false);
    }
  }, [searchQuery, instantResults]);
  
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile, setSelectedProfile } = useProfile();
  const { subscription, isFreePlan } = useSubscription();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    const result = await search(searchQuery);
    setShowSearchResults(true);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // If user presses Enter, redirect to FlixBuddy with their query
      if (searchQuery.trim()) {
        setShowInstantResults(false);
        
        // Track search-to-chat conversion
        posthog.capture('search:redirected_to_flixbuddy', {
          query: searchQuery,
          instant_results_count: instantResults.length
        });
        
        navigate(`/flixbuddy?q=${encodeURIComponent(searchQuery)}`);
        setSearchQuery('');
      }
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

  // Fetch user profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) {
        setUserProfiles([]);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_my_profiles_public');

      if (data && !error) {
        setUserProfiles(data);
      }
    };

    fetchProfiles();
  }, [user]);

  const handleProfileSwitch = (profile: Profile) => {
    // Create a compatible profile object for context
    const profileForContext = {
      id: profile.id,
      display_name: profile.display_name,
      is_kids_profile: profile.is_kids_profile,
      email: user?.email || '',
      user_id: user?.id || ''
    };
    setSelectedProfile(profileForContext);
    posthog?.capture('profile:switched', {
      profile_id: profile.id,
      profile_name: profile.display_name,
      is_kids: profile.is_kids_profile
    });
  };

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
                    <Link 
                      to="/submit-content" 
                      className="text-text-primary hover:text-white font-manrope font-medium transition-colors"
                    >
                      Submit Content
                    </Link>
                    <Link 
                      to="/flixbuddy" 
                      className="text-text-primary hover:text-white font-manrope font-medium transition-colors"
                    >
                      FlixBuddy
                    </Link>
                    {(role === 'admin' || role === 'moderator') && (
                      <Link 
                        to="/admin" 
                        className="text-text-primary hover:text-white font-manrope font-medium transition-colors"
                      >
                        Admin Panel
                      </Link>
                    )}
                    
                    {/* Upgrade button for Basic plan users */}
                    {isFreePlan && (
                      <Link to="/pricing">
                        <Button 
                          variant="default" 
                          size="sm"
                          className="bg-gradient-to-r from-primary-red to-red-600 hover:from-primary-red/90 hover:to-red-600/90 text-white font-semibold"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Upgrade
                        </Button>
                      </Link>
                    )}
                  </div>

                {/* Hybrid Search Input */}
                <div ref={searchRef} className="relative flex-1 max-w-md mx-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search movies or ask for recommendations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    onFocus={() => searchQuery.trim() && instantResults.length > 0 && setShowInstantResults(true)}
                    className="pl-10 bg-background/20 border-gray-700 text-text-primary placeholder:text-muted-foreground focus:border-primary-red"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-red"></div>
                    </div>
                  )}
                  
                  {/* Instant search dropdown */}
                  {showInstantResults && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background-dark border border-gray-700 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                      {instantResults.slice(0, 4).map((video) => (
                        <div
                          key={video.id}
                          className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center space-x-3"
                          onClick={() => {
                            navigate(`/watch/${video.id}`);
                            setSearchQuery('');
                            setShowInstantResults(false);
                          }}
                        >
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-12 h-8 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary text-sm font-medium truncate">
                              {video.title}
                            </p>
                            <p className="text-text-secondary text-xs truncate">
                              {formatDuration(video.duration)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {instantResults.length > 4 && (
                        <div
                          className="px-3 py-2 text-center text-primary-red text-sm cursor-pointer hover:bg-white/10"
                          onClick={() => {
                            handleSearch();
                            setShowInstantResults(false);
                          }}
                        >
                          View all {instantResults.length} results
                        </div>
                      )}
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
                          {selectedProfile?.display_name || 'User'}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-56 bg-background-dark border-gray-700 z-50"
                  >
                    {userProfiles.length > 0 && (
                      <>
                        <DropdownMenuLabel className="text-text-secondary text-xs uppercase">
                          Profiles
                        </DropdownMenuLabel>
                        {userProfiles.map((profile) => (
                          <DropdownMenuItem
                            key={profile.id}
                            onClick={() => handleProfileSwitch(profile)}
                            className="text-text-primary hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                          >
                            <User className="h-4 w-4 mr-2" />
                            <span className="flex-1">
                              {profile.display_name}
                              {profile.is_kids_profile && (
                                <span className="text-xs text-muted-foreground ml-2">(Kids)</span>
                              )}
                            </span>
                            {selectedProfile?.id === profile.id && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem 
                          onClick={() => navigate('/profiles')}
                          className="text-text-primary hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Manage Profiles
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-700" />
                      </>
                    )}
                    <DropdownMenuItem 
                      onClick={() => navigate('/pricing')}
                      className="text-text-primary hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pricing & Plans
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/newsletter-preferences')}
                      className="text-text-primary hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Newsletter Preferences
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-700" />
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
                  className="bg-primary-red hover:bg-primary-red/90 text-white font-manrope font-semibold px-6 py-2"
                >
                  Log In
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Search Results Modal */}
      <Dialog open={showSearchResults} onOpenChange={setShowSearchResults}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-background-dark border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-text-primary font-manrope flex items-center gap-2">
              Search Results for "{searchQuery}"
              {lastSearchType === 'ai' && (
                <span className="text-xs bg-primary-red/20 text-primary-red px-2 py-1 rounded">AI Enhanced</span>
              )}
              {lastSearchType === 'hybrid' && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Smart Search</span>
              )}
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
                       setSearchQuery('');
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
                             setSearchQuery('');
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