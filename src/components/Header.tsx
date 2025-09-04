import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, ChevronDown, LogOut, Search } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile } = useProfile();

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
              </div>

              {/* AI Search Input */}
              <div className="relative flex-1 max-w-md mx-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Ask for a movie recommendation..."
                  className="pl-10 bg-background/20 border-gray-700 text-text-primary placeholder:text-muted-foreground focus:border-primary-red"
                />
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
  );
};

export default Header;