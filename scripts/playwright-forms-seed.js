// Seeds mixed multi-product traffic for the start_form / finish_form
// funnel demo. Fires events server-side via posthog-node so we sidestep
// the browser-side bot filter that drops events from headless UAs.
//
// Distribution (matches the Jun 4 TBC biweekly demo spec):
//   40% one product, completes
//   30% one product, abandons (start only)
//   20% two products, completes both
//   10% three+ products, ~60% completion
//
// (Script name kept as `playwright-forms-seed.js` so existing docs/scripts
// referencing it still resolve.)

import { PostHog } from "posthog-node";
import { randomUUID } from "node:crypto";

const POSTHOG_KEY =
  process.env.VITE_POSTHOG_KEY ||
  "phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh";
const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";
const PRODUCTS = ["subscription", "profile", "payment", "watchlist"];
const TOTAL_USERS = parseInt(process.env.TOTAL_USERS || "200", 10);

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function chooseCohort() {
  const r = Math.random();
  if (r < 0.4) return { products: pickRandom(PRODUCTS, 1), completionRate: 1.0 };
  if (r < 0.7) return { products: pickRandom(PRODUCTS, 1), completionRate: 0.0 };
  if (r < 0.9) return { products: pickRandom(PRODUCTS, 2), completionRate: 1.0 };
  return {
    products: pickRandom(PRODUCTS, 3 + Math.floor(Math.random() * 2)),
    completionRate: 0.6,
  };
}

async function main() {
  const ph = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    flushAt: 50,
    flushInterval: 1000,
  });

  console.log(
    `Seeding ${TOTAL_USERS} synthetic users -> ${POSTHOG_HOST} via posthog-node`
  );
  const startedAt = Date.now();

  let startCount = 0;
  let finishCount = 0;
  const productCounts = { subscription: 0, profile: 0, payment: 0, watchlist: 0 };

  for (let i = 0; i < TOTAL_USERS; i++) {
    const distinctId = `forms-demo-${randomUUID()}`;
    const { products, completionRate } = chooseCohort();

    // Stagger timestamps across the last hour so the funnel has temporal spread.
    const baseTs = new Date(Date.now() - Math.random() * 60 * 60 * 1000);

    for (let j = 0; j < products.length; j++) {
      const product = products[j];
      const startedAtTs = new Date(baseTs.getTime() + j * 90_000); // 90s between products

      ph.capture({
        distinctId,
        event: "start_form",
        properties: {
          product_id: product,
          form_id: `${product}_form_v1`,
          synthetic: true,
          $current_url: `https://hogflix-project.vercel.app/forms/${product}`,
        },
        timestamp: startedAtTs,
      });
      startCount++;
      productCounts[product]++;

      if (Math.random() < completionRate) {
        const finishedAtTs = new Date(startedAtTs.getTime() + 2_000 + Math.random() * 30_000);
        ph.capture({
          distinctId,
          event: "finish_form",
          properties: {
            product_id: product,
            form_id: `${product}_form_v1`,
            synthetic: true,
            $current_url: `https://hogflix-project.vercel.app/forms/${product}`,
          },
          timestamp: finishedAtTs,
        });
        finishCount++;
      }
    }

    if ((i + 1) % 25 === 0 || i + 1 === TOTAL_USERS) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`  ${i + 1}/${TOTAL_USERS} users queued (${elapsed}s elapsed)`);
    }
  }

  await ph.shutdown();
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("Seed complete.");
  console.log(`  Total: ${startCount} start_form + ${finishCount} finish_form events in ${elapsed}s`);
  console.log(`  Per-product start counts: ${JSON.stringify(productCounts)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
