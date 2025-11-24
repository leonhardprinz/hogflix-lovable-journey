import { createContext, useContext, useState, ReactNode } from 'react';
import posthog from 'posthog-js';

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  user_id: string;
  is_kids_profile: boolean;
  early_access_features?: string[];
}

interface ProfileContextType {
  selectedProfile: Profile | null;
  setSelectedProfile: (profile: Profile | null) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider = ({ children }: ProfileProviderProps) => {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const handleSetSelectedProfile = (profile: Profile | null) => {
    setSelectedProfile(profile);
    
    if (profile && posthog.__loaded) {
      // Set user properties for feature flag matching
      posthog.people.set({
        early_access_features: profile.early_access_features || [],
        has_early_access: profile.early_access_features && profile.early_access_features.length > 0
      });
      
      // Set profile as a PostHog group
      posthog.group('profile', profile.id, {
        display_name: profile.display_name,
        is_kids_profile: profile.is_kids_profile,
        has_early_access: profile.early_access_features && profile.early_access_features.length > 0,
        user_id: profile.user_id
      });
      
      posthog.capture('profile:selected', {
        profile_id: profile.id,
        profile_type: profile.is_kids_profile ? 'kids' : 'adult'
      });
    }
  };

  return (
    <ProfileContext.Provider value={{ selectedProfile, setSelectedProfile: handleSetSelectedProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};