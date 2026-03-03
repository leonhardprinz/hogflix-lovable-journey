import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { Clock, RotateCcw } from 'lucide-react';

/**
 * Inactivity Test Controls for Fujifilm RFP Demo (Row 11)
 * Allows testing survey targeting by days since last use
 */
export const InactivityTestControls = () => {
  const [selectedDays, setSelectedDays] = useState<string>('');
  const [currentDays, setCurrentDays] = useState<number>(0);

  const inactivityOptions = [
    { days: 0, label: 'Active today (0 days)', description: 'User just opened app' },
    { days: 3, label: '3 days inactive', description: 'Mild inactivity' },
    { days: 7, label: '7 days inactive', description: 'One week without app' },
    { days: 14, label: '14 days inactive', description: 'Two weeks without app' },
    { days: 30, label: '30 days inactive', description: 'One month - at risk user' },
    { days: 60, label: '60 days inactive', description: 'Two months - churned user' },
    { days: 90, label: '90+ days inactive', description: 'Three months - lost user' },
  ];

  const handleSetInactivity = () => {
    if (!selectedDays) {
      toast.error('Please select an inactivity period');
      return;
    }

    const days = parseInt(selectedDays);
    const lastActiveDate = new Date();
    lastActiveDate.setDate(lastActiveDate.getDate() - days);

    // Set person properties for survey targeting
    posthog.setPersonProperties({
      days_since_last_use: days,
      last_active_at: lastActiveDate.toISOString(),
      inactivity_test_mode: true, // Flag to indicate this is test data
    });

    // Capture event for activity feed
    posthog.capture('admin:inactivity_set', {
      days_inactive: days,
      simulated_last_active: lastActiveDate.toISOString(),
    });

    setCurrentDays(days);
    const option = inactivityOptions.find(o => o.days === days);
    toast.success(`Inactivity set to ${days} days`, {
      description: option?.description || '',
    });

    console.log('🕒 Inactivity properties updated:', {
      days_since_last_use: days,
      last_active_at: lastActiveDate.toISOString(),
      person_id: posthog.get_distinct_id(),
    });
  };

  const handleReset = () => {
    // Reset to active user (0 days)
    posthog.setPersonProperties({
      days_since_last_use: 0,
      last_active_at: new Date().toISOString(),
      inactivity_test_mode: false,
    });

    posthog.capture('admin:inactivity_reset');

    setCurrentDays(0);
    setSelectedDays('');
    toast.success('Reset to active user', {
      description: 'days_since_last_use = 0',
    });
  };

  const getInactivityBadge = () => {
    if (currentDays === 0) {
      return <Badge variant="default" className="text-lg px-3 py-1">Active</Badge>;
    } else if (currentDays <= 7) {
      return <Badge variant="secondary" className="text-lg px-3 py-1">Mildly Inactive</Badge>;
    } else if (currentDays <= 30) {
      return <Badge variant="outline" className="text-lg px-3 py-1 border-yellow-500 text-yellow-700">At Risk</Badge>;
    } else {
      return <Badge variant="destructive" className="text-lg px-3 py-1">Churned</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <CardTitle>Days Since Last Use Testing (Row 11)</CardTitle>
        </div>
        <CardDescription>
          Test survey targeting by user inactivity for Fujifilm RFP demo. Set custom
          days_since_last_use property to simulate inactive users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status Display */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Inactivity Status</p>
              <p className="text-2xl font-bold mt-1">
                {currentDays} day{currentDays !== 1 ? 's' : ''} inactive
              </p>
            </div>
            {getInactivityBadge()}
          </div>
        </div>

        {/* Inactivity Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Simulate Inactivity Period</label>
          <Select value={selectedDays} onValueChange={setSelectedDays}>
            <SelectTrigger>
              <SelectValue placeholder="Select how long user has been inactive..." />
            </SelectTrigger>
            <SelectContent>
              {inactivityOptions.map(option => (
                <SelectItem key={option.days} value={option.days.toString()}>
                  {option.label} - {option.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSetInactivity}
            disabled={!selectedDays}
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2" />
            Set Inactivity
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>How this works:</strong> Sets <code>days_since_last_use</code> and{' '}
            <code>last_active_at</code> person properties. Surveys targeting inactive
            users (e.g., "7+ days since last use") will show/hide based on this value.
          </p>
        </div>

        {/* Person Properties Display */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs font-mono text-muted-foreground mb-2">
            PostHog Person Properties:
          </p>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">days_since_last_use:</span>
              <span className="font-semibold">{currentDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">last_active_at:</span>
              <span className="font-semibold text-xs">
                {new Date(Date.now() - currentDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">inactivity_test_mode:</span>
              <span className="font-semibold">{currentDays > 0 ? 'true' : 'false'}</span>
            </div>
          </div>
        </div>

        {/* Survey Targeting Examples */}
        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
            Survey Targeting Examples:
          </p>
          <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
            <li>• <strong>Win-back survey:</strong> days_since_last_use ≥ 7</li>
            <li>• <strong>At-risk survey:</strong> days_since_last_use ≥ 14</li>
            <li>• <strong>Churn prevention:</strong> days_since_last_use ≥ 30</li>
            <li>• <strong>Re-engagement:</strong> days_since_last_use ≥ 60</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
