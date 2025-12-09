import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  syncCDPPropertiesFromData, 
  clearCDPProperties, 
  hasDemoProfile, 
  getDemoProfile,
  getDemoEmails,
  type CDPProperties 
} from '@/lib/cdp-sync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database, Trash2, CheckCircle, XCircle, Zap, User, Crown, Heart, Tv, CloudDownload, Upload } from 'lucide-react';

interface CDPDemoControlsProps {
  userEmail: string | null;
}

export function CDPDemoControls({ userEmail }: CDPDemoControlsProps) {
  const [isSynced, setIsSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [fetchingR2, setFetchingR2] = useState(false);
  const [r2Data, setR2Data] = useState<CDPProperties | null>(null);
  const [r2Error, setR2Error] = useState<string | null>(null);

  const hasLocalProfile = userEmail ? hasDemoProfile(userEmail) : false;
  const localProfile = userEmail ? getDemoProfile(userEmail) : null;
  const demoEmails = getDemoEmails();

  // Step 1: Fetch data from R2 via HogQL
  const handleFetchR2Data = async () => {
    if (!userEmail) {
      toast.error('No user email found');
      return;
    }

    setFetchingR2(true);
    setR2Error(null);
    setR2Data(null);

    try {
      const { data, error } = await supabase.functions.invoke('query-r2', {
        body: { email: userEmail }
      });

      if (error) {
        console.error('Error fetching R2 data:', error);
        setR2Error(error.message || 'Failed to fetch R2 data');
        toast.error('Failed to fetch R2 data', {
          description: error.message,
        });
        return;
      }

      if (data.error) {
        console.error('R2 query error:', data.error);
        setR2Error(data.error);
        toast.error('No R2 data found', {
          description: data.error,
        });
        return;
      }

      setR2Data(data);
      toast.success('✓ R2 data fetched via HogQL!', {
        description: 'Data retrieved from PostHog Data Warehouse',
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setR2Error('Network error');
      toast.error('Network error fetching R2 data');
    } finally {
      setFetchingR2(false);
    }
  };

  // Step 2: Enrich PostHog profile with fetched data
  const handleEnrichProfile = async () => {
    if (!r2Data) {
      toast.error('Please fetch R2 data first!');
      return;
    }

    setSyncing(true);
    try {
      const success = await syncCDPPropertiesFromData(r2Data);
      if (success) {
        setIsSynced(true);
        toast.success('✓ Person properties enriched!', {
          description: 'Feature flags will now evaluate with R2 data.',
        });
      } else {
        toast.error('Failed to enrich profile');
      }
    } finally {
      setSyncing(false);
    }
  };

  // Fallback: Use hardcoded data
  const handleUseFallback = async () => {
    if (!userEmail || !hasLocalProfile) {
      toast.error('No fallback profile available');
      return;
    }

    setSyncing(true);
    try {
      const profile = getDemoProfile(userEmail);
      if (profile) {
        const success = await syncCDPPropertiesFromData(profile);
        if (success) {
          setIsSynced(true);
          toast.success('✓ Fallback data synced!', {
            description: 'Using hardcoded demo profile.',
          });
        }
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearCDPProperties();
      setIsSynced(false);
      setR2Data(null);
      toast.success('CDP data cleared from PostHog!');
    } finally {
      setClearing(false);
    }
  };

  // Display data (prefer R2, fallback to local)
  const displayData = r2Data || localProfile;

  return (
    <Card className="bg-card-background border-gray-700">
      <CardHeader>
        <CardTitle className="text-text-primary flex items-center gap-2">
          <Database className="h-5 w-5 text-primary-red" />
          CDP Demo Controls
          <Badge variant="outline" className="ml-2 text-xs border-purple-500/50 text-purple-400">
            HogQL → R2
          </Badge>
        </CardTitle>
        <CardDescription className="text-text-secondary">
          Fetch real CRM data from R2 via PostHog's HogQL API, then enrich person properties.
          This enables feature flags like <code className="text-primary-red">vip_retention_offer</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current User Status */}
        <div className="p-4 rounded-lg bg-background-dark border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-secondary">Current User</span>
            {isSynced ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enriched
              </Badge>
            ) : r2Data ? (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                <CloudDownload className="h-3 w-3 mr-1" />
                R2 Data Ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-text-secondary border-gray-600">
                <XCircle className="h-3 w-3 mr-1" />
                Not Synced
              </Badge>
            )}
          </div>
          <p className="font-mono text-text-primary">{userEmail || 'Not logged in'}</p>
          {hasLocalProfile && !r2Data && (
            <p className="text-xs text-yellow-400 mt-1">⚠ Fallback profile available</p>
          )}
        </div>

        {/* R2 Error Display */}
        {r2Error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">❌ {r2Error}</p>
            {hasLocalProfile && (
              <p className="text-xs text-text-secondary mt-1">
                You can use the fallback profile instead.
              </p>
            )}
          </div>
        )}

        {/* Data Preview */}
        {displayData && (
          <div className="p-4 rounded-lg bg-background-dark border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm text-text-secondary">
                {r2Data ? '📊 R2 Data (from HogQL)' : '📁 Fallback Data (hardcoded)'}
              </p>
              {r2Data && (
                <Badge className="bg-purple-500/20 text-purple-400 text-xs">Live</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-400" />
                <span className="text-text-secondary">Health Score:</span>
                <span className={`font-bold ${displayData.customer_health_score < 50 ? 'text-red-400' : 'text-green-400'}`}>
                  {displayData.customer_health_score}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-400" />
                <span className="text-text-secondary">VIP:</span>
                <span className={`font-bold ${displayData.is_vip ? 'text-yellow-400' : 'text-text-secondary'}`}>
                  {displayData.is_vip ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" />
                <span className="text-text-secondary">Tier:</span>
                <span className="font-bold text-purple-400 capitalize">{displayData.power_user_tier}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tv className="h-4 w-4 text-blue-400" />
                <span className="text-text-secondary">Videos:</span>
                <span className="font-bold text-blue-400">{displayData.videos_watched_external}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-text-secondary" />
                <span className="text-text-secondary">LTV:</span>
                <span className="font-bold text-green-400">${displayData.lifetime_value}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Months:</span>
                <span className="font-bold text-text-primary">{displayData.subscription_months}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons - Two Step Flow */}
        <div className="space-y-3">
          {/* Step 1: Fetch R2 Data */}
          <Button
            onClick={handleFetchR2Data}
            disabled={fetchingR2 || !userEmail}
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <CloudDownload className="h-4 w-4" />
            {fetchingR2 ? 'Fetching from R2...' : 'Step 1: Fetch R2 Data (HogQL)'}
          </Button>

          {/* Step 2: Enrich Profile */}
          <Button
            onClick={handleEnrichProfile}
            disabled={syncing || !r2Data}
            className="w-full gap-2 bg-green-600 hover:bg-green-700"
          >
            <Upload className="h-4 w-4" />
            {syncing ? 'Enriching...' : 'Step 2: Enrich PostHog Profile'}
          </Button>

          {/* Fallback & Clear */}
          <div className="flex gap-3">
            {hasLocalProfile && !r2Data && (
              <Button
                onClick={handleUseFallback}
                disabled={syncing}
                variant="outline"
                className="flex-1 gap-2 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              >
                <Database className="h-4 w-4" />
                Use Fallback
              </Button>
            )}
            <Button
              onClick={handleClear}
              disabled={clearing}
              variant="outline"
              className={`gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 ${hasLocalProfile && !r2Data ? 'flex-1' : 'w-full'}`}
            >
              <Trash2 className="h-4 w-4" />
              {clearing ? 'Clearing...' : 'Clear CDP Data'}
            </Button>
          </div>
        </div>

        {/* Demo Emails (fallback reference) */}
        <div className="pt-4 border-t border-gray-700">
          <p className="text-xs text-text-secondary mb-2">Fallback demo profiles (if R2 unavailable):</p>
          <div className="flex flex-wrap gap-2">
            {demoEmails.map(email => (
              <Badge key={email} variant="outline" className="text-xs font-mono text-text-secondary border-gray-600">
                {email}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
