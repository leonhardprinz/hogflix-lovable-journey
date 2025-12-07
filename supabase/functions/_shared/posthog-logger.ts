// PostHog OTLP Logger for Supabase Edge Functions
// Sends structured logs to PostHog Logs via OpenTelemetry Protocol

const POSTHOG_LOGS_ENDPOINT = 'https://eu.i.posthog.com/i/v1/logs';

export type LogLevel = 'info' | 'warn' | 'error';

export async function posthogLog(
  level: LogLevel,
  message: string,
  attributes: Record<string, string | number | boolean> = {},
  serviceName = 'hogflix-edge-functions'
): Promise<void> {
  const apiKey = Deno.env.get('POSTHOG_API_KEY');
  if (!apiKey) {
    console.warn('POSTHOG_API_KEY not set, skipping OTLP log');
    return;
  }

  // Map level to OTLP severity number
  const severityMap: Record<LogLevel, number> = {
    info: 9,   // INFO
    warn: 13,  // WARN
    error: 17, // ERROR
  };

  const resourceLogs = {
    resourceLogs: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: serviceName } },
          { key: 'deployment.environment', value: { stringValue: 'production' } }
        ]
      },
      scopeLogs: [{
        scope: {
          name: 'hogflix-logger',
          version: '1.0.0'
        },
        logRecords: [{
          timeUnixNano: String(Date.now() * 1_000_000),
          severityNumber: severityMap[level],
          severityText: level.toUpperCase(),
          body: { stringValue: message },
          attributes: Object.entries(attributes).map(([key, value]) => ({
            key,
            value: typeof value === 'number'
              ? { intValue: String(value) }
              : typeof value === 'boolean'
              ? { boolValue: value }
              : { stringValue: String(value) }
          }))
        }]
      }]
    }]
  };

  try {
    const response = await fetch(`${POSTHOG_LOGS_ENDPOINT}?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resourceLogs)
    });
    
    if (!response.ok) {
      console.error('PostHog OTLP log failed:', response.status, await response.text());
    }
  } catch (err) {
    console.error('PostHog OTLP log error:', err);
  }
}

// Convenience wrappers
export const log = {
  info: (message: string, attributes?: Record<string, string | number | boolean>) => 
    posthogLog('info', message, attributes),
  warn: (message: string, attributes?: Record<string, string | number | boolean>) => 
    posthogLog('warn', message, attributes),
  error: (message: string, attributes?: Record<string, string | number | boolean>) => 
    posthogLog('error', message, attributes),
};
