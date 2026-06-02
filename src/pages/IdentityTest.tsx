import { useEffect, useState, useCallback } from "react";
import { usePostHog } from "posthog-js/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, UserCheck, RotateCcw, FlaskConical, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type LogEntry = {
  ts: string;
  label: string;
  detail: Record<string, unknown>;
};

const IdentityTest = () => {
  const posthog = usePostHog();
  const [stage1Email, setStage1Email] = useState<string | null>(null);
  const [stage2UserId, setStage2UserId] = useState<string | null>(null);
  const [liveDistinctId, setLiveDistinctId] = useState<string>("(loading)");
  const [log, setLog] = useState<LogEntry[]>([]);

  const refreshDistinctId = useCallback(() => {
    if (!posthog) return;
    try {
      setLiveDistinctId(posthog.get_distinct_id());
    } catch {
      setLiveDistinctId("(unavailable)");
    }
  }, [posthog]);

  useEffect(() => {
    refreshDistinctId();
    const id = setInterval(refreshDistinctId, 1000);
    return () => clearInterval(id);
  }, [refreshDistinctId]);

  const append = (label: string, detail: Record<string, unknown>) => {
    const entry = { ts: new Date().toISOString(), label, detail };
    setLog((prev) => [entry, ...prev].slice(0, 100));
    console.log(`[identity-test] ${label}`, detail);
  };

  const handleStage1 = () => {
    if (!posthog) return;
    const before = posthog.get_distinct_id();
    append("stage1:start", { distinct_id_before: before });

    posthog.capture("identitytest:marketing_pageview");
    append("capture", { event: "identitytest:marketing_pageview" });

    const email = `merge-test-${Date.now()}@example.com`;
    const testRunId = Date.now();
    posthog.setPersonProperties({ email, test_run_id: testRunId });
    append("setPersonProperties", { email, test_run_id: testRunId });

    posthog.capture("identitytest:demo_booked");
    append("capture", { event: "identitytest:demo_booked" });

    const after = posthog.get_distinct_id();
    append("stage1:done", {
      distinct_id_after: after,
      changed: before !== after,
      email,
    });

    setStage1Email(email);
    refreshDistinctId();
  };

  const handleStage2 = () => {
    if (!posthog || !stage1Email) return;
    const before = posthog.get_distinct_id();
    append("stage2:start", { distinct_id_before: before });

    const userId = `test_user_${Date.now()}`;
    posthog.identify(userId, { email: stage1Email });
    append("identify", { userId, email: stage1Email });

    posthog.capture("identitytest:product_signup");
    append("capture", { event: "identitytest:product_signup" });

    const after = posthog.get_distinct_id();
    append("stage2:done", {
      distinct_id_after: after,
      changed: before !== after,
      userId,
    });

    setStage2UserId(userId);
    refreshDistinctId();
  };

  const handleReset = () => {
    if (!posthog) return;
    posthog.reset(true);
    append("reset", { note: "posthog.reset(true) — cookies cleared" });
    setStage1Email(null);
    setStage2UserId(null);
    refreshDistinctId();
  };

  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      <Header />

      <main className="flex-1 container-netflix py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-200 text-sm">
              🧪 <strong>Internal test page.</strong> Verifies whether{" "}
              <code className="bg-black/40 px-1 rounded">posthog.setPersonProperties</code> on an
              anonymous visitor blocks a later{" "}
              <code className="bg-black/40 px-1 rounded">posthog.identify(userId)</code> from
              merging the anonymous trail into the userid person.
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <FlaskConical className="h-12 w-12 text-primary-red mr-4" />
            <h1 className="text-4xl font-bold text-text-primary">Identity Merge Test</h1>
          </div>

          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Status</h2>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-text-secondary">Live distinct_id</dt>
                <dd className="text-text-primary font-mono break-all">{liveDistinctId}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Stage 1 email</dt>
                <dd className="text-text-primary font-mono break-all">
                  {stage1Email ?? <span className="text-text-secondary">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Stage 2 userId</dt>
                <dd className="text-text-primary font-mono break-all">
                  {stage2UserId ?? <span className="text-text-secondary">—</span>}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-start gap-2 text-xs text-yellow-200/80 bg-yellow-500/5 border border-yellow-500/20 rounded p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Note: hogflix's global init in <code>src/main.tsx</code> already calls{" "}
                <code>setPersonProperties</code>(<code>{`{ browser_language }`}</code>) on every
                page load, so the anonymous person profile already has at least one property before
                Stage 1. This actually mirrors a marketing-site that sets multiple props over time.
              </span>
            </div>
          </Card>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Button
              onClick={handleStage1}
              className="h-auto py-6 bg-primary-red hover:bg-primary-red/90 text-white"
            >
              <User className="h-5 w-5" />
              <span className="ml-2">Stage 1: Anonymous + setPersonProperties</span>
            </Button>
            <Button
              onClick={handleStage2}
              disabled={!stage1Email}
              className="h-auto py-6 bg-primary-red hover:bg-primary-red/90 text-white"
            >
              <UserCheck className="h-5 w-5" />
              <span className="ml-2">Stage 2: Identify as userId</span>
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="h-auto py-6 border-gray-700 text-text-primary hover:bg-gray-800"
            >
              <RotateCcw className="h-5 w-5" />
              <span className="ml-2">Reset (clear cookies)</span>
            </Button>
          </div>

          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Action log</h2>
            {log.length === 0 ? (
              <p className="text-text-secondary text-sm">
                No actions yet — click Stage 1 to start. All actions are also{" "}
                <code>console.log</code>'d with the prefix <code>[identity-test]</code>.
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

          <Card className="bg-card-background border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              How to verify in PostHog
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary mb-4">
              <li>
                Click <strong className="text-text-primary">Stage 1</strong>, then (after a beat){" "}
                <strong className="text-text-primary">Stage 2</strong>.
              </li>
              <li>
                In PostHog (project 85924, EU) → <strong>Persons</strong> → search for the Stage 1
                email shown above.
              </li>
              <li>
                Check the person's <strong>Activity</strong> tab for any "refused merge" warnings on
                the identify call.
              </li>
              <li>
                <strong>Bonus:</strong> open this page in a second tab back-to-back (same cookie,
                different tab) and re-run Stage 1+2 — closer to Batıkan's marketing→product
                navigation pattern.
              </li>
            </ol>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="border border-green-500/30 bg-green-500/5 rounded p-4">
                <div className="flex items-center gap-2 text-green-300 font-semibold mb-2">
                  <CheckCircle2 className="h-4 w-4" /> PASS
                </div>
                <p className="text-text-secondary">
                  ONE merged person with two distinct_ids (anon UUID +{" "}
                  <code>test_user_*</code>), <code>email</code> + <code>test_run_id</code> as
                  person properties, and all three <code>identitytest:*</code> events linked.
                </p>
              </div>
              <div className="border border-red-500/30 bg-red-500/5 rounded p-4">
                <div className="flex items-center gap-2 text-red-300 font-semibold mb-2">
                  <XCircle className="h-4 w-4" /> FAIL
                </div>
                <p className="text-text-secondary">
                  TWO separate persons — anonymous trail orphaned from the userid person. Check
                  Activity for refused-merge warnings.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default IdentityTest;
