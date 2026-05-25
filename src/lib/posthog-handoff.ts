/**
 * posthog-handoff
 * --------------------------------------------------------------
 * Reusable primitive for tracking cross-domain redirects to
 * third-party providers (e.g. Stripe Checkout, Digilocker, HyperVerge VKYC).
 *
 * Two events bracket the journey:
 *   {flow}.handoff_initiated  — fired right before window.location is replaced
 *   {flow}.handoff_returned   — fired on the next page load if the user returns
 *
 * Plus a stale-handoff sweeper that converts abandoned redirects into a
 * `handoff_returned` with outcome='timeout' so the funnel never goes silent.
 *
 * Demo-ready for the Razorpay onboarding KYC story.
 */
import type { PostHog } from 'posthog-js';

const STORAGE_KEY = 'posthog_active_handoff';
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export type HandoffOutcome =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'timeout';

export interface HandoffContext {
  /** Logical flow name. Becomes the event prefix. e.g. "onboarding.kyc" -> events "onboarding.kyc.handoff_initiated". */
  flow: string;
  /** Third-party identifier. Stays as a property, never goes into the event name. */
  provider: string;
  /** Where the third-party is expected to redirect back to. */
  expected_return_url: string;
  /** Stable correlation id linking the _initiated and _returned events. */
  handoff_session_id: string;
  /** Epoch ms at initiation. */
  initiated_at: number;
  /** Optional extra business properties (merchant_id, plan, journey_type, etc.). */
  extra?: Record<string, unknown>;
}

function read(): HandoffContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HandoffContext;
  } catch {
    return null;
  }
}

function write(ctx: HandoffContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // sessionStorage may be unavailable (Safari private mode etc.)
  }
}

function clear(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

/**
 * Fire `{flow}.handoff_initiated` and persist context so the return can be matched.
 * Call this RIGHT BEFORE `window.location.href = providerUrl`.
 */
export function initiateHandoff(
  posthog: PostHog | null | undefined,
  ctx: Omit<HandoffContext, 'initiated_at'>,
): HandoffContext {
  const full: HandoffContext = { ...ctx, initiated_at: Date.now() };
  write(full);
  posthog?.capture(`${full.flow}.handoff_initiated`, {
    provider: full.provider,
    expected_return_url: full.expected_return_url,
    handoff_session_id: full.handoff_session_id,
    ...(full.extra ?? {}),
  });
  return full;
}

/**
 * On app mount: if an active handoff exists, fire `{flow}.handoff_returned`
 * with duration + outcome (parsed from URL params by default).
 * Returns the context that was matched, or null if no handoff was active.
 */
export function detectHandoffReturn(
  posthog: PostHog | null | undefined,
  opts: {
    /** Parse outcome + return_code from the current URL. Default: ?handoff_outcome=...&handoff_code=... */
    parseOutcome?: (params: URLSearchParams) => {
      outcome: HandoffOutcome;
      return_code?: string;
    };
  } = {},
): HandoffContext | null {
  const ctx = read();
  if (!ctx) return null;

  const params = new URLSearchParams(window.location.search);
  const parsed =
    opts.parseOutcome?.(params) ?? {
      outcome: (params.get('handoff_outcome') as HandoffOutcome) || 'success',
      return_code: params.get('handoff_code') ?? undefined,
    };

  posthog?.capture(`${ctx.flow}.handoff_returned`, {
    provider: ctx.provider,
    outcome: parsed.outcome,
    return_code: parsed.return_code,
    duration_ms: Date.now() - ctx.initiated_at,
    handoff_session_id: ctx.handoff_session_id,
    ...(ctx.extra ?? {}),
  });
  clear();
  return ctx;
}

/**
 * Periodic sweeper: if a stored handoff is older than `timeoutMs`, fire
 * `{flow}.handoff_returned` with outcome='timeout'. Wire to a setInterval.
 *
 * Razorpay analog: a merchant who opened Digilocker but never came back.
 * The funnel step that follows must never be silent.
 */
export function sweepStaleHandoffs(
  posthog: PostHog | null | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): void {
  const ctx = read();
  if (!ctx) return;
  if (Date.now() - ctx.initiated_at <= timeoutMs) return;

  posthog?.capture(`${ctx.flow}.handoff_returned`, {
    provider: ctx.provider,
    outcome: 'timeout' as HandoffOutcome,
    duration_ms: Date.now() - ctx.initiated_at,
    handoff_session_id: ctx.handoff_session_id,
    ...(ctx.extra ?? {}),
  });
  clear();
}
