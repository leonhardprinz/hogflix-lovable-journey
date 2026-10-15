/**
 * ============================================================================
 * FLAG QA / VARIANT OVERRIDE TEST  —  /dev/flag-qa-test
 * ============================================================================
 * Dev-only harness that empirically proves two claims about forcing a
 * multivariate feature-flag variant on a test user. Built for a QA
 * question: "we force a variant by email in a release condition, but test
 * users keep landing on CONTROL." Goal = test branch LOGIC, not attribution.
 *
 * Backing flag (PostHog project 85924, EU):
 *   key:      qa-variant-test   (id 212038)
 *   variants: control / test (50/50)
 *   group 1:  person email = qa-force@hogflix-demo.com  -> variant "test"   (forced, first)
 *   group 2:  everyone else (default)                   -> variant "control" (deterministic)
 *   url:      https://eu.posthog.com/project/85924/feature_flags/212038
 *
 * ----------------------------------------------------------------------------
 * CLAIM A — "forced variant falls to control when the person/email isn't in
 *            PostHog at eval time."
 *   A release condition keyed on person.email only matches once a person with
 *   that email exists AND flags have been re-fetched. A brand-new / anonymous
 *   distinct_id with no email can't match -> falls to the default (control).
 *   Reproduce with: Reset -> Identify WITHOUT email -> Identify WITH email ->
 *   Re-fetch flags. Watch the timestamped log for exactly when it flips.
 *
 *   Note: posthog-js sends the `$set` person properties ALONG WITH the /flags
 *   request, so the server can often evaluate the email condition on the very
 *   next reloadFeatureFlags() rather than after an ingestion delay. This page
 *   shows whatever actually happens instead of asserting a fixed wait — that
 *   observed timing is itself the answer for the QA team.
 *
 * CLAIM B — "client-side override is the right QA tool for testing branch logic."
 *   overrideFeatureFlags({ flags: { 'qa-variant-test': 'test' } }) forces the
 *   variant locally and instantly, regardless of server assignment, without
 *   touching release conditions and without registering a real exposure.
 *
 * ----------------------------------------------------------------------------
 * SDK reference (installed posthog-js: 1.363.1)
 *   posthog.getFeatureFlag(key)                         -> 'control' | 'test' | undefined
 *   posthog.identify(distinctId, { email })             -> sets person props ($set)
 *   posthog.reset()                                     -> back to a fresh anonymous id
 *   posthog.reloadFeatureFlags()                        -> re-fetch flags from /flags
 *   posthog.onFeatureFlags(cb)                          -> fires when flags refresh
 *   posthog.featureFlags.overrideFeatureFlags({ flags: { key: variant } })  -> local override
 *   posthog.featureFlags.overrideFeatureFlags(false)    -> clear ALL local overrides
 *     (the older posthog.featureFlags.override(...) still exists but is deprecated.)
 *
 * React Native SDK translation (posthog-react-native) — equivalents for Leo:
 *   getFeatureFlag(key) / identify(id,{email}) / reset() / reloadFeatureFlagsAsync()
 *   overrides: posthog.overrideFeatureFlag({ key: variant }) (RN uses overrideFeatureFlag,
 *   singular). Confirm against the installed RN version's typings before quoting.
 * ============================================================================
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  RotateCcw,
  User,
  UserCheck,
  RefreshCw,
  Zap,
  Eraser,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const FLAG_KEY = "qa-variant-test";
const FORCED_EMAIL = "qa-force@hogflix-demo.com";

type LogEntry = {
  ts: string;
  label: string;
  detail: Record<string, unknown>;
};

const FlagQaTest = () => {
  const posthog = usePostHog();
  const [distinctId, setDistinctId] = useState<string>("(loading)");
  const [flagValue, setFlagValue] = useState<string | boolean | undefined>(undefined);
  const [identified, setIdentified] = useState<boolean>(false);
  const [knownEmail, setKnownEmail] = useState<string | null>(null);
  const [overrideActive, setOverrideActive] = useState<boolean>(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  // Reuse the same identify id across the WITHOUT/WITH-email buttons so we're
  // adding the email to the SAME person rather than creating a new one.
  const qaUserIdRef = useRef<string | null>(null);

  const append = useCallback((label: string, detail: Record<string, unknown>) => {
    const entry = { ts: new Date().toISOString(), label, detail };
    setLog((prev) => [entry, ...prev].slice(0, 100));
    console.log(`[flag-qa-test] ${label}`, detail);
  }, []);

  // Read the live flag value + distinct_id and reflect them in the UI/log.
  const readFlag = useCallback(
    (reason: string) => {
      if (!posthog) return undefined;
      const value = posthog.getFeatureFlag(FLAG_KEY);
      const did = posthog.get_distinct_id();
      setFlagValue(value);
      setDistinctId(did);
      append("getFeatureFlag", { reason, [FLAG_KEY]: value ?? "(undefined)", distinct_id: did });
      return value;
    },
    [posthog, append]
  );

  // Poll distinct_id + flag value once a second so the status panel stays live
  // even when flags refresh on their own.
  useEffect(() => {
    if (!posthog) return;
    const tick = () => {
      try {
        setDistinctId(posthog.get_distinct_id());
        setFlagValue(posthog.getFeatureFlag(FLAG_KEY));
      } catch {
        /* ignore transient read errors */
      }
    };
    tick();
    const id = setInterval(tick, 1000);

    // Log every server-side flag refresh so Claim A's timing is explicit.
    const dispose = posthog.onFeatureFlags(() => {
      append("onFeatureFlags(refresh)", { [FLAG_KEY]: posthog.getFeatureFlag(FLAG_KEY) ?? "(undefined)" });
    });

    return () => {
      clearInterval(id);
      if (typeof dispose === "function") dispose();
    };
  }, [posthog, append]);

  // --- Claim A actions -------------------------------------------------------

  const handleReset = () => {
    if (!posthog) return;
    posthog.reset();
    qaUserIdRef.current = null;
    setIdentified(false);
    setKnownEmail(null);
    setOverrideActive(false);
    append("reset", { note: "posthog.reset() — fresh anonymous distinct_id, overrides cleared by reset" });
    posthog.reloadFeatureFlags();
    setTimeout(() => readFlag("after reset + reload"), 50);
  };

  const handleIdentifyWithoutEmail = () => {
    if (!posthog) return;
    const id = `qa_${Date.now()}`;
    qaUserIdRef.current = id;
    posthog.identify(id);
    setIdentified(true);
    setKnownEmail(null);
    append("identify(without email)", { distinct_id: id });
    posthog.reloadFeatureFlags();
    setTimeout(() => readFlag("after identify w/o email + reload"), 50);
  };

  const handleIdentifyWithEmail = () => {
    if (!posthog) return;
    // Reuse the id from the previous step if present, so the email lands on the
    // same person; otherwise mint one.
    const id = qaUserIdRef.current ?? `qa_${Date.now()}`;
    qaUserIdRef.current = id;
    posthog.identify(id, { email: FORCED_EMAIL });
    setIdentified(true);
    setKnownEmail(FORCED_EMAIL);
    append("identify(WITH email)", { distinct_id: id, email: FORCED_EMAIL });
    posthog.reloadFeatureFlags();
    setTimeout(() => readFlag("immediately after identify w/ email + reload"), 50);
  };

  const handleRefetch = () => {
    if (!posthog) return;
    append("reloadFeatureFlags", { note: "manual re-fetch" });
    posthog.reloadFeatureFlags();
    setTimeout(() => readFlag("after manual re-fetch"), 50);
  };

  // --- Claim B actions -------------------------------------------------------

  const handleApplyOverride = () => {
    if (!posthog) return;
    // posthog-js 1.363.1: overrideFeatureFlags({ flags: { key: variant } })
    posthog.featureFlags.overrideFeatureFlags({ flags: { [FLAG_KEY]: "test" } });
    setOverrideActive(true);
    append("overrideFeatureFlags", { flags: { [FLAG_KEY]: "test" }, note: "local-only, no exposure" });
    setTimeout(() => readFlag("after applying local override = test"), 50);
  };

  const handleClearOverride = () => {
    if (!posthog) return;
    // Passing false clears ALL local overrides.
    posthog.featureFlags.overrideFeatureFlags(false);
    setOverrideActive(false);
    append("overrideFeatureFlags(false)", { note: "cleared local overrides — back to server value" });
    setTimeout(() => readFlag("after clearing override"), 50);
  };

  // --- Branch-logic visual ---------------------------------------------------

  const branch =
    flagValue === "test" ? "TEST" : flagValue === "control" ? "CONTROL" : "NONE";

  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      <Header />

      <main className="flex-1 container-netflix py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-200 text-sm">
              🧪 <strong>Internal QA test page.</strong> Proves how a forced multivariate variant
              behaves for the flag <code className="bg-black/40 px-1 rounded">{FLAG_KEY}</code>:
              when a release condition matches (Claim A) vs. when you force it locally for QA
              (Claim B). No impact on the rest of the demo; no extra events beyond what{" "}
              <code className="bg-black/40 px-1 rounded">identify</code> / flag-eval emit.
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <FlaskConical className="h-12 w-12 text-primary-red mr-4" />
            <h1 className="text-4xl font-bold text-text-primary">Flag QA / Variant Override Test</h1>
          </div>

          {/* Branch-logic visual */}
          <Card
            className={`p-6 mb-6 border ${
              branch === "TEST"
                ? "bg-green-500/10 border-green-500/40"
                : branch === "CONTROL"
                ? "bg-blue-500/10 border-blue-500/40"
                : "bg-gray-700/20 border-gray-700"
            }`}
          >
            <div className="text-center">
              <p className="text-text-secondary text-sm mb-1">App would render</p>
              <p
                className={`text-3xl font-bold ${
                  branch === "TEST"
                    ? "text-green-300"
                    : branch === "CONTROL"
                    ? "text-blue-300"
                    : "text-text-secondary"
                }`}
              >
                {branch === "NONE" ? "— no value yet —" : `Rendering ${branch} UI`}
              </p>
              <p className="text-text-secondary text-xs mt-2 font-mono">
                getFeatureFlag('{FLAG_KEY}') = {String(flagValue ?? "undefined")}
                {overrideActive && " (local override active)"}
              </p>
            </div>
          </Card>

          {/* Status */}
          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Status</h2>
            <dl className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-text-secondary">Live distinct_id</dt>
                <dd className="text-text-primary font-mono break-all">{distinctId}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Identified?</dt>
                <dd className="text-text-primary font-mono">{identified ? "yes" : "no (anonymous)"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Email set this session</dt>
                <dd className="text-text-primary font-mono break-all">
                  {knownEmail ?? <span className="text-text-secondary">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Local override</dt>
                <dd className="text-text-primary font-mono">{overrideActive ? "ACTIVE = test" : "none"}</dd>
              </div>
            </dl>
          </Card>

          {/* Claim A buttons */}
          <h3 className="text-lg font-semibold text-text-primary mb-3">
            Claim A — release-condition matching
          </h3>
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Button
              onClick={handleReset}
              variant="outline"
              className="h-auto py-6 border-gray-700 text-text-primary hover:bg-gray-800"
            >
              <RotateCcw className="h-5 w-5" />
              <span className="ml-2">Reset to anonymous</span>
            </Button>
            <Button
              onClick={handleIdentifyWithoutEmail}
              className="h-auto py-6 bg-primary-red hover:bg-primary-red/90 text-white"
            >
              <User className="h-5 w-5" />
              <span className="ml-2">Identify WITHOUT email</span>
            </Button>
            <Button
              onClick={handleIdentifyWithEmail}
              className="h-auto py-6 bg-primary-red hover:bg-primary-red/90 text-white"
            >
              <UserCheck className="h-5 w-5" />
              <span className="ml-2">Identify WITH forced email</span>
            </Button>
            <Button
              onClick={handleRefetch}
              variant="outline"
              className="h-auto py-6 border-gray-700 text-text-primary hover:bg-gray-800"
            >
              <RefreshCw className="h-5 w-5" />
              <span className="ml-2">Re-fetch flags</span>
            </Button>
          </div>

          {/* Claim B buttons */}
          <h3 className="text-lg font-semibold text-text-primary mb-3">
            Claim B — local override (the QA tool)
          </h3>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Button
              onClick={handleApplyOverride}
              className="h-auto py-6 bg-green-600 hover:bg-green-600/90 text-white"
            >
              <Zap className="h-5 w-5" />
              <span className="ml-2">Apply local override = test</span>
            </Button>
            <Button
              onClick={handleClearOverride}
              variant="outline"
              className="h-auto py-6 border-gray-700 text-text-primary hover:bg-gray-800"
            >
              <Eraser className="h-5 w-5" />
              <span className="ml-2">Clear override</span>
            </Button>
          </div>

          {/* Action log */}
          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Action log</h2>
            {log.length === 0 ? (
              <p className="text-text-secondary text-sm">
                No actions yet. Every action is also <code>console.log</code>'d with the prefix{" "}
                <code>[flag-qa-test]</code> and a timestamp.
              </p>
            ) : (
              <div className="font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
                {log.map((e, i) => (
                  <div key={i} className="text-text-primary">
                    <span className="text-text-secondary">{e.ts.split("T")[1]?.slice(0, 12)}</span>{" "}
                    <span className="text-primary-red">{e.label}</span>{" "}
                    <span className="text-text-secondary">{JSON.stringify(e.detail)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Instructions */}
          <Card className="bg-card-background border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">How to run the test</h2>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="border border-blue-500/30 bg-blue-500/5 rounded p-4">
                <div className="flex items-center gap-2 text-blue-300 font-semibold mb-2">
                  <CheckCircle2 className="h-4 w-4" /> Claim A — needs person + email + refresh
                </div>
                <ol className="list-decimal list-inside space-y-1 text-text-secondary">
                  <li>
                    <strong className="text-text-primary">Reset to anonymous</strong> → reads{" "}
                    <code>control</code> (no email on profile).
                  </li>
                  <li>
                    <strong className="text-text-primary">Identify WITHOUT email</strong> → still{" "}
                    <code>control</code>.
                  </li>
                  <li>
                    <strong className="text-text-primary">Identify WITH forced email</strong> →
                    re-read immediately; may still be <code>control</code> (propagation) or already
                    flip — the log shows which.
                  </li>
                  <li>
                    <strong className="text-text-primary">Re-fetch flags</strong> after a beat →
                    should read <code>test</code>. Proves the condition needs the person+email to
                    exist at eval time plus a refresh.
                  </li>
                </ol>
              </div>

              <div className="border border-green-500/30 bg-green-500/5 rounded p-4">
                <div className="flex items-center gap-2 text-green-300 font-semibold mb-2">
                  <Zap className="h-4 w-4" /> Claim B — local override is the QA tool
                </div>
                <ol className="list-decimal list-inside space-y-1 text-text-secondary" start={5}>
                  <li>
                    <strong className="text-text-primary">Reset to anonymous</strong> (back to{" "}
                    <code>control</code>), then{" "}
                    <strong className="text-text-primary">Apply local override = test</strong> →
                    flag reads <code>test</code> instantly. No email, no release condition, no real
                    exposure. The branch panel flips to TEST.
                  </li>
                  <li>
                    <strong className="text-text-primary">Clear override</strong> → returns to the
                    server-assigned value.
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-text-secondary border border-gray-700 rounded p-3">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-text-secondary" />
              <span>
                Takeaway for QA teams: to test branch <strong>logic</strong>, use the local override
                (Claim B) — it's instant and decoupled from release conditions. Reserve
                release-condition matching (Claim A) for verifying real server-side assignment, and
                remember it requires the person+email to exist and a flag refresh.
              </span>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FlagQaTest;
