import type { VercelRequest, VercelResponse } from '@vercel/node';
// NB: explicit .js specifier — required by native Node ESM on Vercel (see api/trending.ts).
import { firstParam } from './_lib/posthog.js';

/**
 * GET /api/finance?endpoint=<name>&<variable>=<value>
 * GET /api/finance?endpoint=_catalog
 *
 * Proxy for the HogFlix Finance demo (/finance). Every figure on that page is one PostHog
 * Endpoint; this function forwards the call with the server-side key and adds call metadata
 * (latency, version, run URL) that the page shows in its info panels.
 *
 * Only endpoints on the allowlist can be called, and callers pass variable values, never SQL.
 */
const HOST = process.env.POSTHOG_HOST || 'https://eu.posthog.com';
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '85924';
const API_KEY = process.env.POSTHOG_ENDPOINTS_API_KEY || process.env.POSTHOG_PERSONAL_API_KEY || '';

const ALLOWED: Record<string, string[]> = {
  fin_kpi_snapshot: [],
  fin_mrr_monthly: [],
  fin_customer_churn_monthly: [],
  fin_mrr_by_segment: ['fin_segment_by'],
  fin_cohort_retention: [],
  fin_cac_by_channel: [],
  fin_investor_quarterly: [],
  fin_payment_failures_weekly: [],
  revenue_summary: ['revenue_source_label'],
};

async function ph(path: string, init?: RequestInit) {
  const started = Date.now();
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/endpoints/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`PostHog returned ${res.status}: ${text.slice(0, 200)}`), { status: res.status });
  return { json: JSON.parse(text), ms: Date.now() - started };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'Missing PostHog API key on the server.' });
    const name = firstParam(req.query.endpoint) ?? '';

    if (name === '_catalog') {
      const { json } = await ph('?limit=100', { method: 'GET' });
      const items = (json.results ?? [])
        .filter((e: { name: string }) => e.name in ALLOWED)
        .map((e: Record<string, any>) => ({
          name: e.name,
          description: e.description,
          sql: e.query?.query ?? null,
          data_freshness_seconds: e.data_freshness_seconds,
          is_materialized: e.is_materialized,
          materialization: e.materialization ?? null,
          current_version: e.current_version,
          versions_count: e.versions_count,
          last_executed_at: e.last_executed_at,
          ui_url: `${HOST}/project/${PROJECT_ID}/endpoints/${e.name}`,
          run_url: `${HOST}/api/projects/${PROJECT_ID}/endpoints/${e.name}/run`,
        }));
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json({ items, source: 'live', fetched_at: new Date().toISOString() });
    }

    if (!(name in ALLOWED)) return res.status(404).json({ error: `Unknown endpoint '${name}'` });
    const variables: Record<string, string> = {};
    for (const v of ALLOWED[name]) {
      const value = firstParam(req.query[v]);
      if (value !== undefined) variables[v] = value.slice(0, 64);
    }

    const { json, ms } = await ph(`${name}/run`, { method: 'POST', body: JSON.stringify({ variables }) });
    if (json.error) throw new Error(json.error);
    const columns: string[] = json.columns ?? [];
    const rows = (json.results ?? []).map((r: unknown[]) => Object.fromEntries(columns.map((c, i) => [c, r[i]])));

    // Short edge cache: keeps a public demo page from burning the project's API rate limit.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({
      columns,
      rows,
      meta: {
        endpoint: name,
        variables,
        source: 'live',
        latency_ms: ms,
        fetched_at: new Date().toISOString(),
        endpoint_version: json.endpoint_version ?? null,
        run_url: `${HOST}/api/projects/${PROJECT_ID}/endpoints/${name}/run`,
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    return res.status(status >= 400 && status < 600 ? status : 502).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
