/* eslint-disable */
// Seeds mixed multi-product traffic against /forms/:product so the
// PostHog funnel attribution-mode toggle (first_touch vs all_steps)
// has a visible effect on per-product conversion rates.

const { chromium } = require("playwright");

const BASE_URL = process.env.HOGFLIX_URL || "https://hogflix-project.vercel.app";
const PRODUCTS = ["subscription", "profile", "payment", "watchlist"];
const TOTAL_USERS = parseInt(process.env.TOTAL_USERS || "200", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5", 10);

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

async function simulateUser(userIndex) {
  const browser = await chromium.launch({ headless: true });
  // Single context across all this user's product visits so the
  // PostHog anonymous distinct_id cookie persists.
  const context = await browser.newContext();
  const page = await context.newPage();

  const { products, completionRate } = chooseCohort();

  for (const product of products) {
    try {
      await page.goto(`${BASE_URL}/forms/${product}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // start_form fires on mount; give PostHog a beat to flush.
      await page.waitForTimeout(800 + Math.random() * 1500);

      if (Math.random() < completionRate) {
        const inputs = await page.locator('input[type="text"]').all();
        for (const input of inputs) {
          await input.fill(`u${userIndex}_${Math.random().toString(36).slice(2, 8)}`);
        }
        await page.locator('[data-testid="submit-button"]').click();
        await page
          .waitForURL(/\/forms\/done/, { timeout: 5000 })
          .catch(() => {});
      }

      await page.waitForTimeout(500 + Math.random() * 1000);
    } catch (err) {
      console.warn(`User ${userIndex} on ${product} failed: ${err.message}`);
    }
  }

  await browser.close();
}

async function main() {
  console.log(
    `Seeding ${TOTAL_USERS} users against ${BASE_URL} with concurrency ${CONCURRENCY}`
  );
  let index = 0;
  let done = 0;
  const startedAt = Date.now();

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < TOTAL_USERS) {
      const myIndex = index++;
      await simulateUser(myIndex);
      done++;
      if (done % 10 === 0 || done === TOTAL_USERS) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
        console.log(`  ${done}/${TOTAL_USERS} users done (${elapsed}s elapsed)`);
      }
    }
  });

  await Promise.all(workers);
  console.log(`Seed complete in ${((Date.now() - startedAt) / 1000).toFixed(0)}s.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
