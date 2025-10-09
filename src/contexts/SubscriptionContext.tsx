import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  features: string[];
  max_profiles: number;
  video_quality: string;
}

interface UserSubscription {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  plan_display_name: string;
  price_monthly: number;
  features: string[];
  max_profiles: number;
  video_quality: string;
  status: string;
  started_at: string;
  expires_at: string | null;
}

interface SubscriptionContextType {
  subscription: UserSubscription | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  hasFeature: (feature: string) => boolean;
  isFreePlan: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_user_subscription', { _user_id: user.id });

      if (error) throw error;

      if (data && data.length > 0) {
        const sub = data[0];
        // Ensure features is properly typed as string array
        const subscription = {
          ...sub,
          features: Array.isArray(sub.features) ? sub.features : []
        } as UserSubscription;
        setSubscription(subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const refreshSubscription = async () => {
    setLoading(true);
    await fetchSubscription();
  };

  const hasFeature = (feature: string): boolean => {
    if (!subscription) return false;
    return (subscription.features as string[]).some(f => 
      f.toLowerCase().includes(feature.toLowerCase())
    );
  };

  const isFreePlan = subscription?.plan_name === 'basic';

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        refreshSubscription,
        hasFeature,
        isFreePlan
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
