import { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  user_id: string;
  is_kids_profile: boolean;
  early_access_features?: string[];
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
  profile: Profile | null;
}

const EditProfileModal = ({ isOpen, onClose, onProfileUpdated, profile }: EditProfileModalProps) => {
  const [profileName, setProfileName] = useState('');
  const [isKidsProfile, setIsKidsProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const posthog = usePostHog();
  const { toast } = useToast();

  // Initialize form when profile changes
  useEffect(() => {
    if (profile) {
      setProfileName(profile.display_name || '');
      setIsKidsProfile(profile.is_kids_profile);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profileName.trim()) {
      toast({
        title: "Error",
        description: "Profile name is required",
        variant: "destructive"
      });
      return;
    }

    if (!profile) return;
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profileName.trim(),
          is_kids_profile: isKidsProfile
        })
        .eq('id', profile.id);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // PostHog analytics
      posthog.capture('profile:updated', {
        profile_id: profile.id,
        profile_name: profileName.trim(),
        is_kids_profile: isKidsProfile
      });

      toast({
        title: "Success",
        description: "Profile updated successfully!"
      });

      onClose();
      
      // Refresh profiles list
      onProfileUpdated();

    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card-background border-gray-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text-primary font-manrope text-xl">
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="profileName" className="text-text-primary font-manrope">
              Profile Name
            </Label>
            <Input
              id="profileName"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="input-netflix mt-2"
              placeholder="Enter profile name"
              maxLength={50}
              required
            />
            <p className="text-xs text-text-tertiary mt-1">
              This name will appear instead of your email address
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isKidsProfile"
              checked={isKidsProfile}
              onCheckedChange={(checked) => setIsKidsProfile(checked as boolean)}
              className="border-text-tertiary data-[state=checked]:bg-primary-red data-[state=checked]:border-primary-red"
            />
            <Label 
              htmlFor="isKidsProfile" 
              className="text-text-primary font-manrope cursor-pointer"
            >
              Kid Profile
            </Label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-text-tertiary text-text-primary hover:bg-text-tertiary/10"
              disabled={loading}
            >
              CANCEL
            </Button>
            <Button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'UPDATING...' : 'SAVE CHANGES'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileModal;