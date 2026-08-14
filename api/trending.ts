import type { VercelRequest, VercelResponse } from '@vercel/node';
// NB: explicit .js specifier — package.json sets "type": "module", so Vercel runs the
// compiled function as native Node ESM, which requires the extension at runtime.
import { runEndpoint, firstParam, sendError } from './_lib/posthog.js';

/**
 * GET /api/trending?lookback_days=30&result_limit=10
 * Proxies the `trending_content` PostHog endpoint: top HogFlix titles by plays.
 * Returns { items: [{ content_id, plays, unique_viewers }, ...] } ranked by plays.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const lookback_days = Number(firstParam(req.query.lookback_days) ?? 30);
    const result_limit = Number(firstParam(req.query.result_limit) ?? 10);

    const { rows } = await runEndpoint('trending_content', { lookback_days, result_limit });

    // Endpoint caches server-side (data_freshness_seconds=3600); mirror that on the CDN.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ items: rows });
  } catch (err) {
    sendError(res, err);
  }
}
