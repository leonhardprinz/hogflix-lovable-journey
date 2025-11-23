import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit3, Loader2, Settings, Check, Calendar } from 'lucide-react';
import NewProfileModal from '@/components/NewProfileModal';
import EditProfileModal from '@/components/EditProfileModal';

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
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { setSelectedProfile } = useProfile();
  const { subscription, loading: subLoading } = useSubscription();

  const fetchProfiles = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_my_profiles_public');

      if (error) {
        console.error('Error fetching profiles:', error);
      } else {
        const mapped = (data || []).map((row: any) => ({
          id: row.id,
          display_name: row.display_name,
          email: null,
          user_id: userId,
          is_kids_profile: row.is_kids_profile,
          early_access_features: row.early_access_features || []
        }));
        setProfiles(mapped);
      }
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

  const handleEditProfile = (profile: Profile, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent profile selection
    setEditingProfile(profile);
    setShowEditProfileModal(true);
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

  if (loading || subLoading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary-red" />
          <p className="text-text-secondary">Loading profiles...</p>
        </div>
      </div>
    );
  }

  const getNextBillingDate = () => {
    const today = new Date();
    const nextBilling = new Date(today);
    nextBilling.setMonth(today.getMonth() + 1);
    return nextBilling.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

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
                  
                  {/* Edit Button */}
                  <button
                    onClick={(e) => handleEditProfile(profile, e)}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-background-dark border-2 border-primary-red rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary-red shadow-lg z-10"
                    title="Edit Profile"
                  >
                    <Edit3 size={16} className="text-primary-red hover:text-white" />
                  </button>
                </div>
                
                {/* Click indicator badge - moved completely outside */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-background-dark border-2 border-primary-red text-primary-red text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg group-hover:bg-primary-red group-hover:text-white transition-all">
                  CLICK TO START
                </div>
              </div>
              <span className="text-text-primary font-manrope text-lg font-semibold group-hover:text-primary-red transition-colors text-center max-w-32 truncate">
                {profile.display_name || 'Set your name'}
              </span>
              {!profile.display_name && (
                <span className="text-xs text-text-tertiary mt-1">
                  Click edit to add your name
                </span>
              )}
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

        {/* Enhanced Subscription Display - Moved Below Profiles */}
        {subscription && (
          <Card className="max-w-2xl mx-auto bg-card/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold">
                        {subscription.plan_display_name} Plan
                      </h3>
                      <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500">
                        Active
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="font-semibold text-foreground">{subscription.video_quality}</span> Quality
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="font-semibold text-foreground">{profiles.length}</span> of{' '}
                        <span className="font-semibold text-foreground">{subscription.max_profiles}</span> profiles
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Next: {getNextBillingDate()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    posthog?.capture('subscription:manage_clicked');
                    navigate('/pricing');
                  }}
                  className="whitespace-nowrap"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => {
          setShowEditProfileModal(false);
          setEditingProfile(null);
        }}
        onProfileUpdated={handleProfileUpdated}
        profile={editingProfile}
      />
    </div>
  );
};

export default Profiles;