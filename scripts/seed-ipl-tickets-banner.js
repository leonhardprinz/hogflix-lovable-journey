#!/usr/bin/env node
/**
 * Seed script for "IPL Tickets Giveaway Banner" experiment (id 82421).
 *
 * Flag key: browse_ipl_tickets_banner
 * Variants:
 *   control        = no banner shown            (loses)
 *   tickets_banner = IPL ticket giveaway banner (CLEAR WINNER)
 *
 * Primary:   browse_ipl_tickets_banner:viewed -> browse_ipl_tickets_banner:clicked
 * Secondary: browse_ipl_tickets_banner:clicked -> pricing:plan_selected
 *
 * Events are spread across the last 7 days. Distinct ID prefix: ipl-tickets-
 */

const POSTHOG_API_KEY = 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh';
const BATCH_URL = 'https://eu.i.posthog.com/batch/';
const FLAG_KEY = 'browse_ipl_tickets_banner';

const RATES = {
  control: {
    // no banner, so no banner:viewed/clicked events.
    // a small fraction still wanders to the pricing page on their own.
    plan_selected: 0.015,
  },
  tickets_banner: {
    viewed: 0.98,            // ~all exposed users on a tickets_banner variant render the strip
    clicked: 0.22,           // 22% of viewed click "Open Premium account"
    plan_selected: 0.18,     // 18% of clicked go on to select a plan on /pricing
  },
};

const TOTAL_USERS = 600;     // per variant

const WINDOW_END_TS = Date.now() - 10 * 60 * 1000;
const WINDOW_START_TS = WINDOW_END_TS - 7 * 24 * 60 * 60 * 1000;
const WINDOW_DURATION_MS = WINDOW_END_TS - WINDOW_START_TS;

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function jitter(ms) {
  return Math.floor(Math.random() * ms);
}

function userBaseTs() {
  return WINDOW_START_TS + Math.random() * WINDOW_DURATION_MS;
}

function ts(baseMs, offsetSeconds) {
  return new Date(baseMs + offsetSeconds * 1000 + jitter(5000)).toISOString();
}

function buildBatch(events) {
  return { api_key: POSTHOG_API_KEY, batch: events };
}

async function sendBatch(events) {
  const res = await fetch(BATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBatch(events)),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Batch failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

function mkEvent(distinctId, name, timestamp, properties = {}) {
  return {
    event: name,
    distinct_id: distinctId,
    timestamp,
    properties: {
      $lib: 'seed-ipl-tickets-banner',
      ...properties,
    },
    uuid: uuid(),
  };
}

function buildUserEvents(index, variant) {
  const distinctId = `ipl-tickets-${variant}-${index}`;
  const base = userBaseTs();
  const events = [];

  // Exposure event (every user assigned to the experiment gets one)
  events.push(mkEvent(distinctId, '$feature_flag_called', ts(base, 0), {
    $feature_flag: FLAG_KEY,
    $feature_flag_response: variant,
  }));

  if (variant === 'tickets_banner') {
    if (Math.random() < RATES.tickets_banner.viewed) {
      events.push(mkEvent(distinctId, 'browse_ipl_tickets_banner:viewed', ts(base, 2), { variant }));

      if (Math.random() < RATES.tickets_banner.clicked) {
        events.push(mkEvent(distinctId, 'browse_ipl_tickets_banner:clicked', ts(base, 6), { variant }));

        if (Math.random() < RATES.tickets_banner.plan_selected) {
          events.push(mkEvent(distinctId, 'pricing:plan_selected', ts(base, 30), {
            plan: 'ultimate',
            variant,
          }));
        }
      }
    }
  } else {
    // control: a tiny background trickle to /pricing without going through the banner
    if (Math.random() < RATES.control.plan_selected) {
      events.push(mkEvent(distinctId, 'pricing:plan_selected', ts(base, 60), {
        plan: 'standard',
        variant,
      }));
    }
  }

  return events;
}

async function run() {
  const startedAt = Date.now();
  const variants = ['control', 'tickets_banner'];
  let totalEvents = 0;

  for (const variant of variants) {
    console.log(`\n→ Seeding ${TOTAL_USERS} users for variant: ${variant}`);
    const allEvents = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
      allEvents.push(...buildUserEvents(i, variant));
    }

    // Chunk batches to stay under any size limits.
    const CHUNK = 500;
    for (let i = 0; i < allEvents.length; i += CHUNK) {
      const slice = allEvents.slice(i, i + CHUNK);
      await sendBatch(slice);
      totalEvents += slice.length;
      process.stdout.write(`  sent ${Math.min(i + CHUNK, allEvents.length)}/${allEvents.length}\r`);
    }
    console.log(`\n  variant ${variant}: ${allEvents.length} events queued`);
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✓ Done. ${totalEvents} events sent across ${variants.length} variants in ${seconds}s.`);
  console.log('  Allow 1-2 min for PostHog ingestion before checking the experiment results.');
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
