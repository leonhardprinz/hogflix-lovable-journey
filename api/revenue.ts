import type { VercelRequest, VercelResponse } from '@vercel/node';
// NB: explicit .js specifier — required by native Node ESM on Vercel (see api/trending.ts).
import { runEndpoint, firstParam, sendError } from './_lib/posthog.js';

/**
 * GET /api/revenue?source_label=<optional>
 * Proxies the `revenue_summary` PostHog endpoint over the Stripe warehouse views.
 * Returns { active_subscriptions, total_revenue, paying_customers, avg_revenue_per_customer }.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const source_label = firstParam(req.query.source_label) ?? '';

    const { rows } = await runEndpoint('revenue_summary', { revenue_source_label: source_label });

    // Revenue moves slowly (endpoint freshness 12h); cache generously.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(rows[0] ?? null);
  } catch (err) {
    sendError(res, err);
  }
}
