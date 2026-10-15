/**
 * ============================================================================
 * DYNAMIC ONBOARDING DEMO - /demo/dynamic-onboarding
 * ============================================================================
 * Customer-facing demo of the loop:
 *   behavior (clicks) → score (person properties) → feature flag with JSON
 *   payload → the next onboarding screen changes, live, no reload.
 *
 * Backing flag (PostHog project 85924, EU):
 *   key:      dynamic-onboarding
 *   variants: family / cinephile / casual, each with a JSON payload
 *             { headline, subline, cta, rows } - see FEATURE_FLAGS_SETUP.md.
 *   Release conditions match on person properties `onboarding_segment` and
 *   `engagement_score`, which Step 2 writes from the client.
 *
 * Same mechanics as /dev/flag-qa-test: posthog-js sends $set person
 * properties along with the /flags request, so reloadFeatureFlags() right
 * after setPersonProperties() usually evaluates against the fresh values -  * the on-screen timer shows the actual round-trip.
 * ============================================================================
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Baby,
  Film,
  Trophy,
  Sparkles,
  Flame,
  Upload,
  ChevronDown,
  Play,
} from "lucide-react";

const FLAG_KEY = "dynamic-onboarding";

const INTERESTS = [
  { key: "kids", label: "Kids", icon: Baby },
  { key: "documentaries", label: "Documentaries", icon: Film },
  { key: "sports", label: "Sports", icon: Trophy },
  { key: "anime", label: "Anime", icon: Sparkles },
] as const;

type InterestKey = (typeof INTERESTS)[number]["key"];
type Segment = "family" | "cinephile" | "casual";

type OnboardingPayload = {
  headline: string;
  subline: string;
  cta: string;
  rows: string[];
};

const STATIC_DEFAULT: OnboardingPayload = {
  headline: "Welcome to Hogflix",
  subline: "Movies and shows for everyone.",
  cta: "Start watching",
  rows: ["Popular", "Trending", "New Releases"],
};

// getFeatureFlagPayload returns untyped JSON; only accept the exact shape we render.
const parsePayload = (raw: unknown): OnboardingPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (
    typeof p.headline === "string" &&
    typeof p.subline === "string" &&
    typeof p.cta === "string" &&
    Array.isArray(p.rows) &&
    p.rows.every((r) => typeof r === "string")
  ) {
    return p as unknown as OnboardingPayload;
  }
  return null;
};

const computeSegment = (interests: InterestKey[]): Segment => {
  if (interests.includes("kids")) return "family";
  if (interests.includes("documentaries")) return "cinephile";
  return "casual";
};

const computeScore = (interests: InterestKey[], bingeIntent: boolean): number =>
  Math.min(100, interests.length * 20 + (bingeIntent ? 40 : 0));

type LogEntry = {
  ts: string;
  label: string;
  detail: Record<string, unknown>;
};

const DynamicOnboardingDemo = () => {
  const posthog = usePostHog();
  const [interests, setInterests] = useState<InterestKey[]>([]);
  const [bingeIntent, setBingeIntent] = useState(false);
  const [writing, setWriting] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [variant, setVariant] = useState<string | boolean | undefined>(undefined);
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const writeStartRef = useRef<number | null>(null);

  const append = useCallback((label: string, detail: Record<string, unknown>) => {
    const entry = { ts: new Date().toISOString(), label, detail };
    setLog((prev) => [entry, ...prev].slice(0, 50));
    console.log(`[dynamic-onboarding] ${label}`, detail);
  }, []);

  const readFlag = useCallback(() => {
    if (!posthog) return;
    const v = posthog.getFeatureFlag(FLAG_KEY);
    const raw = posthog.getFeatureFlagPayload(FLAG_KEY);
    setVariant(v);
    setRawPayload(raw ?? null);
    setPayload(parsePayload(raw));
  }, [posthog]);

  // Keep Step 3 live: re-read on every flag refresh and time the write→refresh
  // round-trip when one is in flight.
  useEffect(() => {
    if (!posthog) return;
    readFlag();
    const dispose = posthog.onFeatureFlags(() => {
      readFlag();
      if (writeStartRef.current !== null) {
        const ms = Math.round(performance.now() - writeStartRef.current);
        writeStartRef.current = null;
        setElapsedMs(ms);
        setWriting(false);
        append("onFeatureFlags(refresh)", {
          elapsed_ms: ms,
          [FLAG_KEY]: posthog.getFeatureFlag(FLAG_KEY) ?? "(undefined)",
        });
      }
    });
    return () => {
      if (typeof dispose === "function") dispose();
    };
  }, [posthog, readFlag, append]);

  const segment = computeSegment(interests);
  const score = computeScore(interests, bingeIntent);

  const toggleInterest = (key: InterestKey) => {
    const selected = !interests.includes(key);
    setInterests((prev) => (selected ? [...prev, key] : prev.filter((k) => k !== key)));
    posthog?.capture("onboarding_interest_selected", {
      interest: key,
      selected,
      total_selected: selected ? interests.length + 1 : interests.length - 1,
    });
    append("onboarding_interest_selected", { interest: key, selected });
  };

  const toggleBinge = (checked: boolean) => {
    setBingeIntent(checked);
    posthog?.capture("onboarding_binge_intent_toggled", { binge_intent: checked });
    append("onboarding_binge_intent_toggled", { binge_intent: checked });
  };

  const handleWriteSignal = () => {
    if (!posthog) return;
    setWriting(true);
    setElapsedMs(null);
    posthog.setPersonProperties({
      onboarding_segment: segment,
      engagement_score: score,
    });
    posthog.capture("onboarding_signal_written", {
      onboarding_segment: segment,
      engagement_score: score,
      interests,
      binge_intent: bingeIntent,
    });
    append("setPersonProperties", {
      onboarding_segment: segment,
      engagement_score: score,
    });
    writeStartRef.current = performance.now();
    posthog.reloadFeatureFlags();
  };

  const experience = payload ?? STATIC_DEFAULT;
  const isDynamic = payload !== null;

  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      <Header />

      <main className="flex-1 container-netflix py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-text-primary mb-2">Dynamic Onboarding</h1>
            <p className="text-text-secondary">
              Behavior → score → person property → feature flag payload → the next screen changes.
              No page reload.
            </p>
          </div>

          {/* Step 1 - Behave */}
          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-primary-red text-white">Step 1</Badge>
              <h2 className="text-xl font-semibold text-text-primary">Behave</h2>
              <span className="text-text-secondary text-sm">
                Pick interests - each click is a captured event
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {INTERESTS.map(({ key, label, icon: Icon }) => {
                const active = interests.includes(key);
                return (
                  <Button
                    key={key}
                    onClick={() => toggleInterest(key)}
                    variant={active ? "default" : "outline"}
                    className={
                      active
                        ? "h-auto py-6 bg-primary-red hover:bg-primary-red/90 text-white"
                        : "h-auto py-6 border-gray-700 text-text-primary hover:bg-gray-800"
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span className="ml-2">{label}</span>
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 border border-gray-700 rounded-lg p-4">
              <Flame className={`h-5 w-5 ${bingeIntent ? "text-primary-red" : "text-text-secondary"}`} />
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium">I watch daily</p>
                <p className="text-text-secondary text-xs">
                  Binge intent - captured as <code>onboarding_binge_intent_toggled</code>
                </p>
              </div>
              <Switch checked={bingeIntent} onCheckedChange={toggleBinge} />
            </div>
          </Card>

          {/* Step 2 - Score */}
          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-primary-red text-white">Step 2</Badge>
              <h2 className="text-xl font-semibold text-text-primary">Score</h2>
              <span className="text-text-secondary text-sm">
                A visible computation - this would normally live in your backend or a PostHog CDP
                destination
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="border border-gray-700 rounded-lg p-4">
                <p className="text-text-secondary text-xs mb-1">onboarding_segment</p>
                <p className="text-2xl font-bold text-text-primary capitalize">{segment}</p>
                <p className="text-text-secondary text-xs mt-2 font-mono">
                  kids selected → "family"
                  <br />
                  else documentaries → "cinephile"
                  <br />
                  else → "casual"
                </p>
              </div>
              <div className="border border-gray-700 rounded-lg p-4">
                <p className="text-text-secondary text-xs mb-1">engagement_score</p>
                <p className="text-2xl font-bold text-text-primary">{score} / 100</p>
                <p className="text-text-secondary text-xs mt-2 font-mono">
                  {interests.length} interest{interests.length === 1 ? "" : "s"} × 20
                  {" + "}
                  {bingeIntent ? "40 (watches daily)" : "0 (no binge intent)"}
                  {" = "}
                  {interests.length * 20 + (bingeIntent ? 40 : 0)}
                  {interests.length * 20 + (bingeIntent ? 40 : 0) > 100 ? " → capped at 100" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleWriteSignal}
                disabled={writing || !posthog}
                className="bg-primary-red hover:bg-primary-red/90 text-white"
              >
                <Upload className="h-4 w-4" />
                <span className="ml-2">{writing ? "Writing + re-fetching flags..." : "Write signal to PostHog"}</span>
              </Button>
              {elapsedMs !== null && (
                <span className="text-sm text-green-400 font-mono">
                  person properties set → flags refreshed in {elapsedMs} ms
                </span>
              )}
            </div>
            <p className="text-text-secondary text-xs mt-3 font-mono">
              posthog.setPersonProperties({"{"} onboarding_segment, engagement_score {"}"}) →
              posthog.reloadFeatureFlags()
            </p>
          </Card>

          {/* Step 3 - Experience */}
          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-primary-red text-white">Step 3</Badge>
              <h2 className="text-xl font-semibold text-text-primary">Experience</h2>
              {isDynamic ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Dynamic - flag variant: {String(variant)}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-text-secondary border-gray-600">
                  Static default - flag off / no payload
                </Badge>
              )}
            </div>

            {/* Mock onboarding welcome screen rendered from the flag payload */}
            <div
              className={`rounded-xl border p-8 text-center ${
                isDynamic
                  ? "bg-gradient-to-b from-red-950/40 to-black border-primary-red/40"
                  : "bg-gradient-to-b from-zinc-900 to-black border-gray-700"
              }`}
            >
              <p className="text-sm uppercase tracking-widest text-primary-red mb-3">
                Hogflix Onboarding
              </p>
              <h3 className="text-3xl font-bold text-text-primary mb-2">{experience.headline}</h3>
              <p className="text-text-secondary mb-6">{experience.subline}</p>
              <Button className="bg-primary-red hover:bg-primary-red/90 text-white mb-8">
                <Play className="h-4 w-4" />
                <span className="ml-2">{experience.cta}</span>
              </Button>

              <div className="text-left">
                <p className="text-text-secondary text-xs mb-2">Content rows, in order:</p>
                <div className="space-y-2">
                  {experience.rows.map((row, i) => (
                    <div
                      key={row}
                      className="flex items-center gap-3 border border-gray-800 rounded-lg p-3 bg-black/40"
                    >
                      <span className="text-text-secondary text-xs font-mono w-4">{i + 1}</span>
                      <span className="text-text-primary text-sm font-medium">{row}</span>
                      <div className="flex gap-2 ml-auto">
                        {[0, 1, 2, 3].map((n) => (
                          <div key={n} className="w-10 h-6 rounded bg-gray-800" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Collapsible className="mt-4">
              <CollapsibleTrigger className="flex items-center gap-2 text-text-secondary text-sm hover:text-text-primary">
                <ChevronDown className="h-4 w-4" />
                Raw flag payload - getFeatureFlagPayload('{FLAG_KEY}')
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 p-4 rounded-lg bg-black/60 border border-gray-800 text-xs text-text-primary font-mono overflow-x-auto">
                  {rawPayload ? JSON.stringify(rawPayload, null, 2) : "null  // flag off or no payload - rendering the static default above"}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Under the hood - the actual plumbing, shown in context */}
          <Card className="bg-card-background border-gray-800 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="outline" className="text-text-secondary border-gray-600">
                Under the hood
              </Badge>
              <h2 className="text-xl font-semibold text-text-primary">The whole plumbing</h2>
              <span className="text-text-secondary text-sm">
                4 SDK calls in the app, 1 flag in PostHog. Nothing else.
              </span>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="border border-gray-700 rounded-lg p-4">
                <p className="text-text-primary text-sm font-medium mb-2">
                  In the app - the code this page runs
                </p>
                <pre className="p-3 rounded-lg bg-black/60 border border-gray-800 text-xs text-text-primary font-mono overflow-x-auto leading-relaxed">
{`// 1. behavior -> events
posthog.capture('onboarding_interest_selected',
  { interest, selected })

// 2. score -> person properties
posthog.setPersonProperties({
  onboarding_segment: segment,   // "${segment}"
  engagement_score: score,       // ${score}
})

// 3. re-evaluate flags against the new
//    properties (no reload, no release)
posthog.reloadFeatureFlags()

// 4. render the screen from the payload
const variant = posthog.getFeatureFlag(
  'dynamic-onboarding')          // "${String(variant ?? "-")}"
const ui = posthog.getFeatureFlagPayload(
  'dynamic-onboarding')
// -> { headline, subline, cta, rows }`}
                </pre>
                <p className="text-text-secondary text-xs mt-2">
                  posthog-js sends the new properties along with the flag request, so the
                  round-trip is one network call - the timer in Step 2 is measuring it.
                </p>
              </div>

              <div className="border border-gray-700 rounded-lg p-4">
                <p className="text-text-primary text-sm font-medium mb-2">
                  In PostHog - the flag, evaluated top to bottom
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className={`rounded-lg border p-3 ${variant === "family" ? "border-green-500/50 bg-green-500/5" : "border-gray-800 bg-black/40"}`}>
                    <p className="text-text-secondary mb-1">Set 1</p>
                    <p className="text-text-primary">onboarding_segment = family</p>
                    <p className="text-primary-red">→ variant "family"</p>
                  </div>
                  <div className={`rounded-lg border p-3 ${variant === "cinephile" ? "border-green-500/50 bg-green-500/5" : "border-gray-800 bg-black/40"}`}>
                    <p className="text-text-secondary mb-1">Set 2</p>
                    <p className="text-text-primary">onboarding_segment = cinephile AND engagement_score ≥ 60</p>
                    <p className="text-primary-red">→ variant "cinephile"</p>
                  </div>
                  <div className={`rounded-lg border p-3 ${variant === "casual" ? "border-green-500/50 bg-green-500/5" : "border-gray-800 bg-black/40"}`}>
                    <p className="text-text-secondary mb-1">Set 3</p>
                    <p className="text-text-primary">everyone else</p>
                    <p className="text-primary-red">→ variant "casual"</p>
                  </div>
                </div>
                <p className="text-text-secondary text-xs mt-3">
                  Each variant carries the JSON payload rendered in Step 3 (open the raw payload
                  above). The green box is the set matching this browser right now. Swapping the
                  score source for a real model changes nothing in this page - the model just
                  writes the same two properties from the backend or a CDP destination.
                </p>
              </div>
            </div>
          </Card>

          {/* Action log */}
          <Card className="bg-card-background border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Action log</h2>
            {log.length === 0 ? (
              <p className="text-text-secondary text-sm">
                No actions yet. Everything is also <code>console.log</code>'d with the prefix{" "}
                <code>[dynamic-onboarding]</code>.
              </p>
            ) : (
              <div className="font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
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
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DynamicOnboardingDemo;
