/* All explanatory copy lives here so it can be re-pointed at a different audience in one place. */
/* The audience label comes from the URL (?for=Acme) so no customer name lives in this public repo. */
window.AUDIENCE = {
  name: (new URLSearchParams(location.search).get('for') || '').replace(/[^\w .&-]/g, '').slice(0, 40) || 'your team',
  show: true,
};

/* key -> info panel. `endpoint` must match a PostHog Endpoint name. */
window.INFO = {
  kpi: {
    endpoint: 'fin_kpi_snapshot',
    title: 'Headline KPIs',
    what: 'One row: MRR, ARR, subscribers, ARPA and the month-to-date movement, all computed in a single pass over the billing ledger.',
    why: 'These are the numbers leadership asks for first. They should be identical on the wall screen, in the board pack and in a spreadsheet, because they are the same API call.',
    better: [
      'The definition of MRR lives in one saved query, not in three spreadsheets and a BI tool.',
      'Freshness is set per endpoint (this one refreshes every 15 minutes), so a wall screen can poll it without re-running the query each time.',
      'An app like this needs a key with one scope, endpoint:read. It can call endpoints and cannot read raw events or persons.',
    ],
    you: 'Where does the number your leadership trusts come from today, and how many places re-implement it?',
  },
  mrrTrend: {
    endpoint: 'fin_mrr_monthly',
    title: 'MRR over time',
    what: 'Ending MRR per month: a running total of every ledger movement (new, expansion, reactivation, contraction, churn).',
    why: 'The shape of this line is the company story. Two events are visible here: a price increase in March 2026 and a partner bundle launch in June 2026.',
    better: [
      'The running total is a SQL window function inside the endpoint. The app receives finished numbers and only draws them.',
      'Change the definition (say, exclude paused subscriptions) and a new endpoint version is created. Consumers can pin a version, so a board pack never shifts under you.',
    ],
    you: 'If a definition changed mid-quarter today, how would you know which reports picked it up?',
  },
  mrrWaterfall: {
    endpoint: 'fin_mrr_monthly',
    title: 'MRR movements',
    what: 'The same endpoint as the trend line, read column by column: what was added and what was lost each month.',
    why: 'Net new MRR hides the mechanics. March 2026 shows it well: expansion jumped from the price increase while churn rose in the same month.',
    better: [
      'One endpoint feeds two charts and the sheet view. Nothing is fetched or defined twice.',
      'Each call is logged with an execution id, duration and row count, so "where did this figure come from" has an audit trail.',
    ],
    you: 'Which of these movements can you split out today without someone building it by hand?',
  },
  mrrSegment: {
    endpoint: 'fin_mrr_by_segment',
    title: 'MRR by segment',
    what: 'Current MRR split by plan, country, region or channel. The split is a variable (fin_segment_by) passed in the API call.',
    why: 'Concentration risk and mix shift. Switch to channel: Partner is already a visible slice three months after launch, at a lower ARPA.',
    better: [
      'One parameterised endpoint instead of four near-identical queries. Callers pass a value for the variable, never SQL.',
      'Adding a dimension is a change to the endpoint, not to every consumer.',
    ],
    you: 'Which cuts do you get asked for that currently mean a new export?',
  },
  customers: {
    endpoint: 'fin_customer_churn_monthly',
    title: 'Subscribers, churn and NRR',
    what: 'Per month: starting and ending subscribers, logo churn, revenue churn, net revenue retention and ARPA.',
    why: 'The March 2026 price increase is the test case: logo churn jumped from about 4.0% to 5.3% for two months, while net revenue retention that month was 99%. One response carries both sides of that trade.',
    better: [
      'Rates are computed against the opening balance of each month inside the query, so every consumer uses the same denominator.',
      'Freshness is one hour here. Closed months never change, so this is a strong candidate for materialisation: pre-computed results served from storage, with higher rate limits.',
    ],
    you: 'Do finance and product quote the same churn number today?',
  },
  cohort: {
    endpoint: 'fin_cohort_retention',
    title: 'Cohort retention',
    what: 'Share of each signup cohort still subscribed after N months.',
    why: 'Blended churn hides which customers are leaving. Read down column M1: most cohorts keep about 91% after one month, but the February and March 2026 cohorts kept 87 to 88%, because their first renewal landed on the price increase.',
    better: [
      'The cohort logic is the hard part, and it is written once. A spreadsheet version of this table is where most retention disagreements start.',
      'Daily freshness: cohort tables do not need to be real time, and the endpoint says so explicitly.',
    ],
    you: 'Which acquisition bets from this year would you want to see as their own cohort line?',
  },
  cac: {
    endpoint: 'fin_cac_by_channel',
    title: 'Spend, CAC and payback',
    what: 'Acquisition spend joined to new subscribers and new MRR, per channel and closed month. CAC = spend / new subscribers. Payback = spend / new MRR.',
    why: 'Paid Social CAC creeps up month after month while Referral stays flat. The blended number hides it, more so since the cheap partner channel launched.',
    better: [
      'Spend and revenue are two different sources joined in one query. In production these would be warehouse tables (ad platforms, billing) next to product events.',
      'Only closed months are reported, so a half-finished month never shows an artificially low CAC.',
    ],
    you: 'Where does spend data live today, and who joins it to revenue?',
  },
  investor: {
    endpoint: 'fin_investor_quarterly',
    title: 'Investor pack',
    what: 'Quarterly roll-up: ending ARR, net new ARR, subscribers added and lost.',
    why: 'The same ledger as the operating views, at the grain investors read. No separate "investor model" to reconcile before a raise.',
    better: [
      'A link on your own domain, behind your own access control, reading the same endpoints. The reporting surface is yours, the numbers are governed centrally.',
      'Each endpoint publishes an OpenAPI spec, so a typed client can be generated instead of hand-written.',
    ],
    you: 'How long does it take to assemble the numbers for a board meeting or a data room today?',
  },
  failures: {
    endpoint: 'fin_payment_failures_weekly',
    title: 'Payment failures (live product events)',
    what: 'Real HogFlix product telemetry, not seeded: checkout payment errors on the Ultimate plan, per week.',
    why: 'This is revenue that never reaches the billing system, so it never appears in a billing export. Finance only sees it if product data and finance data sit in the same place.',
    better: [
      'Same API, same key, same app: a product event stream and a billing ledger served side by side.',
      'From here a finance user can ask engineering for the exact sessions behind a spike, because the events link to session replays.',
    ],
    you: 'Which leading indicators of revenue sit in product data that finance cannot see today?',
  },
  stripe: {
    endpoint: 'revenue_summary',
    title: 'Stripe via the data warehouse',
    what: 'A real Stripe test account synced into the PostHog data warehouse, read through an endpoint. Small numbers on purpose: it is a sandbox account.',
    why: 'It shows the production pattern. The large ledger in this demo is synthetic events; with a real billing source the endpoints on top look the same.',
    better: [
      'Sources sync on a schedule (Stripe, Postgres, BigQuery, Snowflake, S3 and others). Modelling happens in saved SQL views, endpoints sit on the views.',
      'Warehouse tables join to product events in the same query.',
    ],
    you: 'Is billing truth in Stripe, in your warehouse, or somewhere else?',
  },
};

window.TABS = [
  { id: 'live', name: 'Live KPIs', title: 'Live KPIs', lede: 'The numbers for the wall screen. One endpoint, refreshed every 15 minutes.' },
  { id: 'mrr', name: 'MRR', title: 'Monthly recurring revenue', lede: 'Where MRR stands, how it got there and where it is concentrated.' },
  { id: 'mom', name: 'Month over month', title: 'Month over month', lede: 'Last closed month against the month before and the same month last year.' },
  { id: 'customers', name: 'Customers & churn', title: 'Customers and churn', lede: 'Subscriber base, logo churn, revenue churn and net revenue retention.' },
  { id: 'cohorts', name: 'Cohorts', title: 'Cohort retention', lede: 'How well each signup month holds on to its subscribers.' },
  { id: 'cac', name: 'Spend & CAC', title: 'Spend and CAC', lede: 'What a new subscriber costs per channel and how fast it pays back.' },
  { id: 'investor', name: 'Investor pack', title: 'Investor pack', lede: 'The quarterly view, from the same ledger as everything else.' },
  { sep: true },
  { id: 'sheet', name: 'Sheet', title: 'The sheet', lede: 'Every metric by month in one grid. Export it, or point Google Sheets at the same endpoints.' },
  { id: 'wiring', name: 'How it is wired', title: 'How it is wired', lede: 'Sources, models, endpoints, surfaces. What runs where, and what this app is allowed to see.' },
];
