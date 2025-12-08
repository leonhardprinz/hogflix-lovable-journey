import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  syncCDPProperties, 
  clearCDPProperties, 
  hasDemoProfile, 
  getDemoProfile,
  getDemoEmails,
  type CDPProperties 
} from '@/lib/cdp-sync';
import { toast } from 'sonner';
import { Database, Trash2, CheckCircle, XCircle, Zap, User, Crown, Heart, Tv } from 'lucide-react';

interface CDPDemoControlsProps {
  userEmail: string | null;
}

export function CDPDemoControls({ userEmail }: CDPDemoControlsProps) {
  const [isSynced, setIsSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const hasProfile = userEmail ? hasDemoProfile(userEmail) : false;
  const profile = userEmail ? getDemoProfile(userEmail) : null;
  const demoEmails = getDemoEmails();

  const handleSync = async () => {
    if (!userEmail) {
      toast.error('No user email found');
      return;
    }

    setSyncing(true);
    try {
      const success = syncCDPProperties(userEmail);
      if (success) {
        setIsSynced(true);
        toast.success('CDP data synced to PostHog!', {
          description: 'Person properties have been updated. Feature flags will now evaluate with the new data.',
        });
      } else {
        toast.error('Failed to sync CDP data', {
          description: `No demo profile found for ${userEmail}`,
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      clearCDPProperties();
      setIsSynced(false);
      toast.success('CDP data cleared from PostHog!', {
        description: 'Person properties have been removed. Feature flags will reset to default values.',
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="bg-card-background border-gray-700">
      <CardHeader>
        <CardTitle className="text-text-primary flex items-center gap-2">
          <Database className="h-5 w-5 text-primary-red" />
          CDP Demo Controls
        </CardTitle>
        <CardDescription className="text-text-secondary">
          Sync customer data from R2 to PostHog person properties for the Active CDP demo.
          This enables feature flags like <code className="text-primary-red">vip_retention_offer</code> and{' '}
          <code className="text-primary-red">power_user_early_access</code>.
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
                Synced
              </Badge>
            ) : (
              <Badge variant="outline" className="text-text-secondary border-gray-600">
                <XCircle className="h-3 w-3 mr-1" />
                Not Synced
              </Badge>
            )}
          </div>
          <p className="font-mono text-text-primary">{userEmail || 'Not logged in'}</p>
          {hasProfile ? (
            <p className="text-xs text-green-400 mt-1">✓ Demo profile available</p>
          ) : userEmail ? (
            <p className="text-xs text-yellow-400 mt-1">⚠ No demo profile for this email</p>
          ) : null}
        </div>

        {/* Profile Preview */}
        {profile && (
          <div className="p-4 rounded-lg bg-background-dark border border-gray-700">
            <p className="text-sm text-text-secondary mb-3">Profile Data (from R2)</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-400" />
                <span className="text-text-secondary">Health Score:</span>
                <span className={`font-bold ${profile.customer_health_score < 50 ? 'text-red-400' : 'text-green-400'}`}>
                  {profile.customer_health_score}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-400" />
                <span className="text-text-secondary">VIP:</span>
                <span className={`font-bold ${profile.is_vip ? 'text-yellow-400' : 'text-text-secondary'}`}>
                  {profile.is_vip ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" />
                <span className="text-text-secondary">Tier:</span>
                <span className="font-bold text-purple-400 capitalize">{profile.power_user_tier}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tv className="h-4 w-4 text-blue-400" />
                <span className="text-text-secondary">Videos:</span>
                <span className="font-bold text-blue-400">{profile.videos_watched_external}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-text-secondary" />
                <span className="text-text-secondary">LTV:</span>
                <span className="font-bold text-green-400">${profile.lifetime_value}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Months:</span>
                <span className="font-bold text-text-primary">{profile.subscription_months}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleSync}
            disabled={syncing || !hasProfile}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          >
            <Database className="h-4 w-4" />
            {syncing ? 'Syncing...' : 'Sync CDP Data'}
          </Button>
          <Button
            onClick={handleClear}
            disabled={clearing}
            variant="outline"
            className="flex-1 gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            {clearing ? 'Clearing...' : 'Clear CDP Data'}
          </Button>
        </div>

        {/* Demo Emails */}
        <div className="pt-4 border-t border-gray-700">
          <p className="text-xs text-text-secondary mb-2">Available demo profiles:</p>
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
