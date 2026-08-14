import type { VercelResponse } from '@vercel/node';

/**
 * Server-side helper for calling PostHog Endpoints (saved HogQL queries exposed as an API).
 *
 * The personal API key MUST stay server-side — never ship it in the browser bundle. These
 * helpers run only inside Vercel serverless functions (`api/*.ts`), which read the key from
 * `process.env`. The React app calls `/api/*` and never sees the key.
 *
 * Endpoints demoed here (project 85924, EU): trending_content, viewer_stats, revenue_summary.
 */

const HOST = process.env.POSTHOG_HOST || 'https://eu.posthog.com';
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '85924';
// Prefer a dedicated endpoint:read-scoped key; fall back to the existing personal API key.
const API_KEY =
  process.env.POSTHOG_ENDPOINTS_API_KEY || process.env.POSTHOG_PERSONAL_API_KEY || '';

export class PostHogEndpointError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PostHogEndpointError';
    this.status = status;
  }
}

export interface EndpointRunResult<T = Record<string, unknown>> {
  columns: string[];
  rows: T[];
  endpointVersion?: number;
}

/**
 * Run a named PostHog endpoint and return its rows as objects keyed by column name.
 * The run API returns `{ results: [[cell, ...]], columns: [...] }`; we zip them together
 * so callers get `{ content_id, plays, ... }` instead of positional arrays.
 */
export async function runEndpoint<T = Record<string, unknown>>(
  name: string,
  variables: Record<string, unknown> = {},
): Promise<EndpointRunResult<T>> {
  if (!API_KEY) {
    throw new PostHogEndpointError(
      500,
      'Missing PostHog API key. Set POSTHOG_ENDPOINTS_API_KEY (or POSTHOG_PERSONAL_API_KEY) in the environment.',
    );
  }

  const url = `${HOST}/api/projects/${PROJECT_ID}/endpoints/${name}/run`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ variables }),
    });
  } catch (e) {
    throw new PostHogEndpointError(502, `Could not reach PostHog: ${(e as Error).message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    // Surface PostHog's status (401 bad key, 403 missing scope, 404 name, 429 rate limit, 5xx).
    throw new PostHogEndpointError(res.status, `Endpoint '${name}' returned ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: { results?: unknown[][]; columns?: string[]; error?: string; endpoint_version?: number };
  try {
    data = JSON.parse(text);
  } catch {
    throw new PostHogEndpointError(502, `Endpoint '${name}' returned non-JSON response`);
  }
  if (data.error) {
    throw new PostHogEndpointError(502, `Endpoint '${name}' query error: ${data.error}`);
  }

  const columns = data.columns ?? [];
  const rows = (data.results ?? []).map(
    (row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])) as T,
  );
  return { columns, rows, endpointVersion: data.endpoint_version };
}

/** Read the first value of a query param that may arrive as string | string[]. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Map any thrown error to a clean JSON error response with the right status. */
export function sendError(res: VercelResponse, err: unknown): void {
  const status = err instanceof PostHogEndpointError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Unknown error';
  res.status(status).json({ error: message });
}
