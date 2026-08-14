import type { VercelRequest, VercelResponse } from '@vercel/node';
// NB: explicit .js specifier — required by native Node ESM on Vercel (see api/trending.ts).
import { runEndpoint, firstParam, sendError } from './_lib/posthog.js';

/**
 * GET /api/viewer-stats?distinct_id=<id>&lookback_days=30
 * Proxies the `viewer_stats` PostHog endpoint: a single viewer's watch summary.
 * The client passes its own posthog distinct_id; we map it to the endpoint's
 * `viewer_distinct_id` variable. Returns { plays, completions, watch_hours, top_genre }.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const distinctId = firstParam(req.query.distinct_id);
    const lookback_days = Number(firstParam(req.query.lookback_days) ?? 30);

    const variables: Record<string, unknown> = { lookback_days };
    // Omit when absent so the endpoint's default (hf-demo-viewer) is used for the demo.
    if (distinctId) variables.viewer_distinct_id = distinctId;

    const { rows } = await runEndpoint('viewer_stats', variables);

    // Personalized + cheap: keep it fresh so a live watch shows up quickly in the demo.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    res.status(200).json(rows[0] ?? null);
  } catch (err) {
    sendError(res, err);
  }
}
