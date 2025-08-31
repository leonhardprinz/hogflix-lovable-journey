import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { User, Plus } from 'lucide-react';
import NewProfileModal from '@/components/NewProfileModal';

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  user_id: string;
  is_kids_profile: boolean;
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching profiles:', error);
      } else {
        setProfiles(data || []);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-text-primary">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <div className="container-netflix py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-text-primary mb-4 font-manrope">
            Who's Watching?
          </h1>
          <p className="text-text-secondary font-manrope">
            Select your profile to continue
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 max-w-4xl mx-auto">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => handleProfileSelect(profile)}
              className="flex flex-col items-center cursor-pointer group"
            >
              <div className="w-32 h-32 bg-card-background rounded-lg flex items-center justify-center mb-4 card-hover border-2 border-transparent group-hover:border-primary-red transition-all duration-200 relative">
                <User size={48} className="text-text-secondary" />
                {profile.is_kids_profile && (
                  <div className="absolute top-2 right-2 bg-primary-red text-white text-xs px-2 py-1 rounded">
                    KIDS
                  </div>
                )}
              </div>
              <span className="text-text-primary font-manrope text-lg group-hover:text-primary-red transition-colors">
                {profile.display_name || profile.email?.split('@')[0] || 'Profile'}
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