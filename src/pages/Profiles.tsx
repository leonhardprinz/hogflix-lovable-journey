import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import NewProfileModal from '@/components/NewProfileModal';

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  user_id: string;
  is_kids_profile: boolean;
  early_access_features?: string[];
}

const Profiles = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);
  
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { setSelectedProfile } = useProfile();

  const fetchProfiles = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_my_profiles_public');

      if (error) {
        console.error('Error fetching profiles:', error);
        setLoading(false);
        return;
      }
      
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        display_name: row.display_name,
        email: null,
        user_id: userId,
        is_kids_profile: row.is_kids_profile,
        early_access_features: row.early_access_features || []
      }));
      
      // AUTO-SELECT: If only one profile, select it and go to browse
      if (mapped.length === 1) {
        console.log('Single profile detected, auto-selecting...');
        setSelectedProfile(mapped[0]);
        posthog?.capture('profile:auto_selected', {
          profile_id: mapped[0].id,
          reason: 'single_profile'
        });
        navigate('/browse');
        return;
      }
      
      setProfiles(mapped);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuthAndFetchProfiles = async () => {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/login');
        return;
      }

      setUser(session.user);
      await fetchProfiles(session.user.id);
      setLoading(false);
    };

    checkAuthAndFetchProfiles();
  }, [navigate]);

  const handleProfileSelect = (profile: Profile) => {
    // Store in global state
    setSelectedProfile(profile);

    // PostHog: Normal identify call (links events to this user)
    if (posthog && user) {
      posthog.identify(user.id, {
        email: user.email,
        profile_id: profile.id,
        profile_name: profile.display_name
      });
    }

    // PostHog: Group identify (associates user with profile group)
    if (posthog) {
      posthog.group('profile', profile.id, {
        display_name: profile.display_name,
        is_kids_profile: profile.is_kids_profile,
        user_id: profile.user_id
      });
    }

    // Initialize PostHog person properties for early access features
    if (posthog) {
      posthog.setPersonProperties({
        early_access_features: profile.early_access_features || []
      });
    }

    // PostHog analytics
    posthog.capture('profile:selected', {
      profile_id: profile.id,
      profile_name: profile.display_name || profile.email
    });

    // Redirect to browse
    navigate('/browse');
  };

  const handleAddProfile = () => {
    setShowNewProfileModal(true);
  };


  const handleProfileCreated = async () => {
    if (user) {
      await fetchProfiles(user.id);
    }
  };

  const handleProfileUpdated = async () => {
    if (user) {
      await fetchProfiles(user.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary-red" />
          <p className="text-text-secondary">Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <div className="container-netflix py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-text-primary mb-6 font-manrope">
            Who's Watching?
          </h1>
          <p className="text-2xl font-semibold text-primary-red font-manrope animate-pulse">
            👇 Click Your Profile to Continue 👇
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 max-w-4xl mx-auto mb-12">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => handleProfileSelect(profile)}
              className="flex flex-col items-center cursor-pointer group relative transform transition-all duration-300 hover:scale-110"
            >
              <div className="relative pb-8">
                {/* Animated ring indicator */}
                <div className="absolute inset-0 w-32 h-32 rounded-lg border-4 border-primary-red animate-pulse group-hover:animate-none" />
                
                <div className="w-32 h-32 rounded-lg flex items-center justify-center card-hover border-4 border-primary-red group-hover:shadow-[0_0_30px_rgba(220,38,38,0.8)] transition-all duration-300 relative" style={{ backgroundColor: 'rgb(220, 38, 38)' }}>
                  {/* Hedgehog emoji as icon */}
                  <span className="text-6xl group-hover:scale-110 transition-transform">🦔</span>
                  
                  {profile.is_kids_profile && (
                    <div className="absolute top-2 right-2 bg-background-dark text-white text-xs px-2 py-1 rounded border border-white">
                      KIDS
                    </div>
                  )}
                </div>
                
                {/* Click indicator badge - moved completely outside */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-background-dark border-2 border-primary-red text-primary-red text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg group-hover:bg-primary-red group-hover:text-white transition-all">
                  CLICK TO START
                </div>
              </div>
              <span className="text-text-primary font-manrope text-lg font-semibold group-hover:text-primary-red transition-colors text-center max-w-32 truncate">
                {profile.display_name || 'Set your name'}
              </span>
            </div>
          ))}

          {/* Add Profile Card */}
          <div
            onClick={handleAddProfile}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="w-32 h-32 bg-card-background rounded-lg flex items-center justify-center mb-4 card-hover border-2 border-dashed border-text-tertiary group-hover:border-primary-red transition-all duration-200">
              <Plus size={48} className="text-text-tertiary group-hover:text-primary-red transition-colors" />
            </div>
            <span className="text-text-tertiary font-manrope text-lg group-hover:text-primary-red transition-colors">
              Add Profile
            </span>
          </div>
        </div>

        {profiles.length === 0 && (
          <div className="text-center mt-12">
            <p className="text-text-secondary mb-6 font-manrope">
              No profiles found. Let's get you started!
            </p>
            <Button
              onClick={handleAddProfile}
              className="btn-primary"
            >
              Create Your First Profile
            </Button>
          </div>
        )}
      </div>

      {/* New Profile Modal */}
      {user && (
        <NewProfileModal
          isOpen={showNewProfileModal}
          onClose={() => setShowNewProfileModal(false)}
          onProfileCreated={handleProfileCreated}
          userId={user.id}
        />
      )}
    </div>
  );
};

export default Profiles;