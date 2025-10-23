import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { usePostHog } from 'posthog-js/react';
import { toast } from 'sonner';

export default function BetaFeatures() {
  const navigate = useNavigate();
  const { selectedProfile } = useProfile();
  const posthog = usePostHog();
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    document.title = 'Beta Features - HogFlix';
    
    console.log('🔍 BetaFeatures: selectedProfile =', selectedProfile);
    
    if (!selectedProfile?.id) {
      console.log('❌ No profile selected, redirecting to /profiles');
      navigate('/profiles');
      return;
    }

    console.log('📋 Profile early_access_features:', selectedProfile.early_access_features);
    
    // Use early_access_features from the profile context
    const hasAccess = selectedProfile.early_access_features?.includes('ai_summaries') || false;
    console.log('✅ Has AI summaries access:', hasAccess);
    setIsOptedIn(hasAccess);
    setLoading(false);
  }, [selectedProfile, navigate]);

  const handleToggle = async () => {
    if (!selectedProfile?.id || updating) return;

    setUpdating(true);

    try {
      const currentFeatures = selectedProfile.early_access_features || [];
      const newFeatures = isOptedIn
        ? currentFeatures.filter((f: string) => f !== 'ai_summaries')
        : [...currentFeatures, 'ai_summaries'];

      // Update using user_id to comply with RLS policies
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ early_access_features: newFeatures })
        .eq('user_id', selectedProfile.user_id)
        .eq('id', selectedProfile.id);

      if (updateError) throw updateError;

      // Update PostHog person properties
      posthog.setPersonProperties({
        early_access_features: newFeatures
      });

      // Track the opt-in or opt-out event
      posthog.capture(isOptedIn ? 'early_access:opted_out' : 'early_access:opted_in', {
        feature: 'ai_summaries',
        profile_id: selectedProfile.id
      });

      setIsOptedIn(!isOptedIn);
      
      toast.success(
        isOptedIn 
          ? "You've left the beta program" 
          : "✅ You're now in the AI Summaries beta!"
      );
    } catch (error) {
      console.error('Error updating early access:', error);
      toast.error('Failed to update beta features. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-text-primary">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2 flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-400" />
            Beta Features
          </h1>
          <p className="text-text-secondary">
            Try out new experimental features before they're released to everyone
          </p>
        </div>

        <Alert className="mb-6 bg-yellow-900/20 border-yellow-600/30">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            ⚠️ Beta features may have bugs or change significantly. Your feedback helps us improve!
          </AlertDescription>
        </Alert>

        <Card className="bg-surface border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl flex items-center gap-2 text-text-primary">
                  <Sparkles className="h-6 w-6 text-purple-400" />
                  AI-Generated Video Summaries
                </CardTitle>
                <CardDescription className="mt-2 text-text-secondary">
                  Get instant AI-powered summaries of videos as you watch. Powered by Gemini AI.
                </CardDescription>
              </div>
              <div className="ml-4">
                <Switch
                  checked={isOptedIn}
                  onCheckedChange={handleToggle}
                  disabled={updating}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-purple-400">📝</span>
                <span className="text-text-secondary">Understand video content at a glance</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400">⚡</span>
                <span className="text-text-secondary">Save time deciding what to watch</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400">🎯</span>
                <span className="text-text-secondary">Jump to key moments</span>
              </div>
            </div>

            {isOptedIn && (
              <div className="mt-4 p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
                <p className="text-green-300 text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  You're now in the beta! Watch any video to see AI summaries in action.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
