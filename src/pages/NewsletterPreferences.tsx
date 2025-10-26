import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, Shield } from 'lucide-react';

const NewsletterPreferences = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { toast } = useToast();
  
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialValue, setInitialValue] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchPreferences();
  }, [user, navigate]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('marketing_opt_in')
        .eq('user_id', user?.id)
        .single();

      if (!error && data) {
        setMarketingOptIn(data.marketing_opt_in ?? true);
        setInitialValue(data.marketing_opt_in ?? true);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      if (import.meta.env.DEV) {
        console.log('Saving preferences for user:', user.id);
        console.log('Marketing opt-in value:', marketingOptIn);
      }
      
      // Update database
      const { data, error } = await supabase
        .from('profiles')
        .update({ marketing_opt_in: marketingOptIn })
        .eq('user_id', user.id)
        .select();

      if (import.meta.env.DEV) {
        console.log('Update result:', { data, error });
      }

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Check if any rows were actually updated
      if (!data || data.length === 0) {
        throw new Error('No profile found to update. Please contact support.');
      }

      // Update PostHog person properties
      posthog.setPersonProperties({
        marketing_opt_in: marketingOptIn,
        marketing_opt_in_updated_at: new Date().toISOString()
      });

      // Track preference change
      posthog.capture('marketing_preferences:updated', {
        previous_value: initialValue,
        new_value: marketingOptIn,
        source: 'preferences_page'
      });

      setInitialValue(marketingOptIn);

      toast({
        title: "Preferences saved",
        description: "Your newsletter preferences have been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <div className="container-netflix py-12">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6 text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {/* Header */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 bg-primary-red/20 rounded-lg flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary-red" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary font-manrope">
                Newsletter Preferences
              </h1>
              <p className="text-text-secondary mt-1">
                Manage your email communication settings
              </p>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-card-background rounded-lg p-8 space-y-6 border border-gray-800">
            {/* Email Display */}
            <div>
              <Label className="text-sm text-text-secondary mb-2 block">
                Your Email
              </Label>
              <div className="text-text-primary font-medium">
                {user?.email}
              </div>
            </div>

            <div className="border-t border-gray-800" />

            {/* Newsletter Opt-In */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="marketing-opt-in"
                  checked={marketingOptIn}
                  onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="marketing-opt-in"
                    className="text-base text-text-primary cursor-pointer font-medium"
                  >
                    Send me newsletters and updates
                  </Label>
                  <p className="text-sm text-text-secondary mt-1">
                    Receive product tips, new content announcements, and special offers from HogFlix
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={saving || marketingOptIn === initialValue}
                className="w-full bg-primary-red hover:bg-primary-red/90 text-white font-semibold"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mt-6 bg-card-background/50 rounded-lg p-6 border border-gray-800">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-primary-red mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  Privacy & Security
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  We respect your privacy. You can change your email preferences at any time. 
                  We'll only send emails about new HogFlix content, product updates, and special offers. 
                  Your data will never be sold to third parties.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsletterPreferences;
