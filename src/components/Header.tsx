import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';

const Header = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const posthog = usePostHog();

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

      // Redirect to login
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="w-full bg-background-dark border-b border-gray-800">
      <div className="container-netflix flex items-center justify-between py-4">
        <h1 
          onClick={() => navigate('/')}
          className="text-3xl font-bold text-primary-red cursor-pointer font-manrope"
        >
          HogFlix
        </h1>

        <nav className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-4">
              <span className="text-text-secondary font-manrope">
                Welcome, {user.email}
              </span>
              <Button
                onClick={handleLogout}
                disabled={loading}
                variant="outline"
                className="border-primary-red text-primary-red hover:bg-primary-red hover:text-white"
              >
                {loading ? 'LOGGING OUT...' : 'LOG OUT'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/login')}
                variant="ghost"
                className="text-text-primary hover:text-primary-red"
              >
                LOG IN
              </Button>
              <Button
                onClick={() => navigate('/signup')}
                className="btn-primary"
              >
                SIGN UP
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;