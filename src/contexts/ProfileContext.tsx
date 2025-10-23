import { createContext, useContext, useState, ReactNode } from 'react';

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

  return (
    <ProfileContext.Provider value={{ selectedProfile, setSelectedProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};