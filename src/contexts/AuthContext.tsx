import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import posthog from 'posthog-js';
import { initializeUserProperties } from '@/lib/posthog-utils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // PostHog user identification
        if (event === 'SIGNED_IN' && session?.user) {
          posthog.identify(session.user.id, {
            email: session.user.email,
          });
          
          // Initialize user properties on login (deferred to avoid blocking)
          setTimeout(async () => {
            const { data: subData } = await supabase
              .rpc('get_user_subscription', { _user_id: session.user.id });
            
            if (subData && subData.length > 0) {
              await initializeUserProperties(
                session.user.id,
                session.user.email || '',
                {
                  plan_name: subData[0].plan_name,
                  status: subData[0].status
                }
              );
            } else {
              await initializeUserProperties(session.user.id, session.user.email || '');
            }
          }, 0);
          
          console.log('👤 PostHog: User identified', session.user.id);
        } else if (event === 'SIGNED_OUT') {
          posthog.reset();
          console.log('👋 PostHog: User session reset');
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};