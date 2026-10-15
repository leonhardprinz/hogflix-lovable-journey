/**
 * End-to-end check of the PII redaction path used by flixbuddy-chat:
 *   1. real FlixBuddy traces -> services/pii-redactor (Presidio + GLiNER)
 *   2. same traces with the service unreachable -> regex fallback
 *   3. one $ai_generation event per engine captured to the Hogflix EU project,
 *      tagged demo_source=pii-redaction-test so it can be found and deleted.
 *
 *   PII_REDACTION_URL=http://localhost:8787 deno run --allow-net --allow-env --allow-read scripts/test-pii-redaction.ts
 */
import { redactAIContentRemote } from '../supabase/functions/_shared/pii-redactor.ts';

const SERVICE = Deno.env.get('PII_REDACTION_URL') ?? 'http://localhost:8787';
const env = Object.fromEntries(
  (await Deno.readTextFile('.env')).split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
  }),
);
const POSTHOG_KEY = env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

const SYSTEM = 'You are FlixBuddy, the AI assistant for HogFlix streaming service.';
const SAMPLES = [
  {
    name: 'hogflix trace 019ce172',
    user: 'Hi! My name is Leo Prinz, I live at Trubarjeva cesta 79A in Ljubljana. My email is leo@example.com and my phone is +386 41 123 456. My kid Luna wants to watch something funny tonight',
    assistant: "Hi Leo! It's fantastic to connect with you and help Luna find the perfect funny movie for tonight! I'm FlixBuddy, and I'm super excited to dive into our catalog. Have you seen Interstellar or The Grand Budapest Hotel?",
  },
  {
    name: 'hogflix trace 019ce13c',
    user: 'Ok this is a test of PII data scrubbing. I am Leo Prinz and live at Uferstr. 15. My bank number is 0943042349235052345. I also like pineapple on pizza',
    assistant: "Hello there! I'm FlixBuddy, your guide to all the amazing adventures on HogFlix! Pineapple on pizza is certainly... a choice!",
  },
  {
    name: 'added: asian names',
    user: 'Hello FlixBuddy, this is Wei Zhang from Singapore, my colleague Tanaka Yuki recommended you. Reach me at wei.zhang@example.sg or +65 9123 4567. We liked Parasite and Shoplifters.',
    assistant: 'Welcome Wei! If you and Tanaka Yuki liked Parasite, try Burning or Memories of Murder on HogFlix.',
  },
];
const LEAKS = ['Leo Prinz', 'Trubarjeva', 'leo@example.com', '123 456', '0943042349235052345', 'Uferstr', 'Wei Zhang', 'Tanaka Yuki', 'wei.zhang@example.sg', '9123 4567', 'Luna'];

async function capture(event: string, properties: Record<string, unknown>) {
  const res = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_KEY, event, properties: { distinct_id: 'pii-redaction-test', ...properties }, timestamp: new Date().toISOString() }),
  });
  return res.status;
}

let failures = 0;
for (const [label, url] of [['service', SERVICE], ['fallback', 'http://127.0.0.1:9']] as const) {
  console.log(`\n=== ${label} (${url})`);
  for (const s of SAMPLES) {
    const t0 = performance.now();
    const inRes = await redactAIContentRemote([{ role: 'system', content: SYSTEM }, { role: 'user', content: s.user }], url, 1500);
    const outRes = await redactAIContentRemote([{ role: 'assistant', content: s.assistant }], url, 1500);
    const ms = Math.round(performance.now() - t0);
    const texts = [...inRes.messages, ...outRes.messages].map((m) => m.content).join(' | ');
    const leaked = LEAKS.filter((l) => texts.includes(l));
    // The regex fallback is best effort by design; only the service path must be leak-free.
    const ok = (label === 'fallback' || leaked.length === 0) && inRes.messages[0].content === SYSTEM;
    if (!ok) failures++;
    console.log(`${ok ? (leaked.length ? 'WARN' : 'PASS') : 'FAIL'} ${s.name} [${inRes.engine}, ${ms} ms]${leaked.length ? ' leaked: ' + leaked.join(', ') : ''}`);
    console.log('   user      ->', inRes.messages[1].content);
    console.log('   assistant ->', outRes.messages[0].content);
    const status = await capture('$ai_generation', {
      $ai_model: 'gemini-2.5-flash', $ai_provider: 'google',
      $ai_input: inRes.messages, $ai_output_choices: outRes.messages,
      $ai_input_tokens: 120, $ai_output_tokens: 60, $ai_total_cost_usd: 0.00005, $ai_latency: 0.9,
      $ai_trace_id: crypto.randomUUID(), $ai_http_status: 200, $ai_is_error: false, $ai_prompt_name: 'flixbuddy-chat',
      $ai_content_redacted: true, $ai_redaction_engine: inRes.engine,
      $ai_redacted_entity_count: (inRes.entities?.length || 0) + (outRes.entities?.length || 0),
      demo_source: 'pii-redaction-test', sample: s.name,
    });
    console.log(`   captured to PostHog: HTTP ${status}`);
  }
}
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
Deno.exit(failures ? 1 : 0);
