import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { Globe, Check } from 'lucide-react';

/**
 * Language Test Controls for Fujifilm RFP Demo
 * Allows testing survey targeting by language/locale
 */
export const LanguageTestControls = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [currentLanguage, setCurrentLanguage] = useState<string>(
    navigator.language || 'en-US'
  );

  const languages = [
    { code: 'ja-JP', label: '🇯🇵 Japanese (Japan)', language: 'ja' },
    { code: 'en-US', label: '🇺🇸 English (US)', language: 'en' },
    { code: 'en-GB', label: '🇬🇧 English (UK)', language: 'en' },
    { code: 'ko-KR', label: '🇰🇷 Korean (Korea)', language: 'ko' },
    { code: 'zh-CN', label: '🇨🇳 Chinese (Simplified)', language: 'zh' },
    { code: 'zh-TW', label: '🇹🇼 Chinese (Traditional)', language: 'zh' },
    { code: 'es-ES', label: '🇪🇸 Spanish (Spain)', language: 'es' },
    { code: 'fr-FR', label: '🇫🇷 French (France)', language: 'fr' },
    { code: 'de-DE', label: '🇩🇪 German (Germany)', language: 'de' },
  ];

  const handleSetLanguage = () => {
    if (!selectedLanguage) {
      toast.error('Please select a language');
      return;
    }

    const lang = languages.find(l => l.code === selectedLanguage);
    if (!lang) return;

    // Set as person property for survey targeting
    posthog.setPersonProperties({
      locale: lang.code,
      language: lang.language,
      language_override: true, // Flag to indicate this was manually set for testing
    });

    // Also capture an event to show in the activity feed
    posthog.capture('admin:language_changed', {
      previous_locale: currentLanguage,
      new_locale: lang.code,
      new_language: lang.language,
    });

    setCurrentLanguage(lang.code);
    toast.success(`Language set to ${lang.label}`, {
      description: 'Person properties updated for survey targeting',
    });

    console.log('🌍 Language properties updated:', {
      locale: lang.code,
      language: lang.language,
      person_id: posthog.get_distinct_id(),
    });
  };

  const handleResetToDefault = () => {
    const browserLanguage = navigator.language || 'en-US';
    const languageCode = browserLanguage.split('-')[0];

    posthog.setPersonProperties({
      locale: browserLanguage,
      language: languageCode,
      language_override: false,
    });

    posthog.capture('admin:language_reset', {
      previous_locale: currentLanguage,
      default_locale: browserLanguage,
    });

    setCurrentLanguage(browserLanguage);
    setSelectedLanguage('');
    toast.success('Language reset to browser default', {
      description: `Using ${browserLanguage}`,
    });
  };

  const currentLangObj = languages.find(l => l.code === currentLanguage);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <CardTitle>Language/Locale Testing</CardTitle>
        </div>
        <CardDescription>
          Test survey targeting by language for Fujifilm RFP demo. Change your
          language to see different surveys.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Language Display */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Language</p>
              <p className="text-2xl font-bold mt-1">
                {currentLangObj?.label || currentLanguage}
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {currentLanguage}
            </Badge>
          </div>
        </div>

        {/* Language Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Test Different Language</label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Select a language to test..." />
            </SelectTrigger>
            <SelectContent>
              {languages.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSetLanguage}
            disabled={!selectedLanguage}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            Set Language
          </Button>
          <Button onClick={handleResetToDefault} variant="outline">
            Reset to Default
          </Button>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>How this works:</strong> Sets <code>locale</code> and{' '}
            <code>language</code> person properties in PostHog. Surveys
            targeting these properties will now show/hide based on your
            selection.
          </p>
        </div>

        {/* Person Properties Display */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs font-mono text-muted-foreground mb-2">
            PostHog Person Properties:
          </p>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">locale:</span>
              <span className="font-semibold">{currentLanguage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">language:</span>
              <span className="font-semibold">
                {currentLanguage.split('-')[0]}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
