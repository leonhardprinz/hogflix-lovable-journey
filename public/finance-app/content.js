/* All explanatory copy lives here so it can be re-pointed at a different audience in one place. */
/* The audience label comes from the URL (?for=Acme) so no customer name lives in this public repo. */
window.AUDIENCE = {
  name: (new URLSearchParams(location.search).get('for') || '').replace(/[^\w .&-]/g, '').slice(0, 40) || 'your team',
  show: true,
};

/* key -> info panel. Three short parts: why this runs in PostHog, what it shows, a question for the room. */
window.INFO = {
  kpi: {
    endpoint: 'fin_kpi_snapshot',
    title: 'Headline KPIs',
    posthog: 'Your product data already sits in PostHog. Sync billing in, write the SQL once and you get a URL. Nobody builds a pipeline or hosts an API for it.',
    what: 'MRR, ARR, subscribers and ARPA. One call, one row.',
    you: 'Where does the MRR number your leadership trusts come from today?',
  },
  mrrTrend: {
    endpoint: 'fin_mrr_monthly',
    title: 'MRR over time',
    posthog: 'The maths is SQL saved in PostHog, not in this app. Change it and you get a new version. Old reports can stay on the old one.',
    what: 'MRR at the end of each month.',
    you: 'If the MRR definition changed mid-quarter, which reports would notice?',
  },
  mrrWaterfall: {
    endpoint: 'fin_mrr_monthly',
    title: 'MRR movements',
    posthog: 'Same endpoint as the line above, so the two charts cannot disagree. Every call is logged in PostHog, so you can trace where a figure came from.',
    what: 'What added MRR each month and what took it away.',
    you: 'Which of these can you split out today without someone building it by hand?',
  },
  mrrSegment: {
    endpoint: 'fin_mrr_by_segment',
    title: 'MRR by segment',
    posthog: 'One endpoint with one variable. A new cut is one SQL change in PostHog, not a new export.',
    what: "Today's MRR by plan, region, country or channel.",
    you: 'Which cuts do you get asked for that mean a new export?',
  },
  mom: {
    endpoint: 'fin_mrr_monthly',
    title: 'Month over month',
    posthog: 'Two endpoints side by side. Nobody pulls this together at month end, it is just there.',
    what: 'Last closed month against the month before and a year ago.',
    you: 'How long does the monthly close pack take today?',
  },
  customers: {
    endpoint: 'fin_customer_churn_monthly',
    title: 'Subscribers, churn and NRR',
    posthog: 'Churn is worked out once, in PostHog, against the same opening balance. Finance and product read the same number because there is only one.',
    what: 'Subscribers, logo churn, revenue churn and NRR per month.',
    you: 'Do finance and product quote the same churn number?',
  },
  cohort: {
    endpoint: 'fin_cohort_retention',
    title: 'Cohort retention',
    posthog: 'Cohort SQL is where most retention arguments start, and here it is written once. Signups are product events PostHog already has, so you could also split cohorts by what people did in the product.',
    what: 'How much of each signup month is still paying.',
    you: 'Which bets from this year deserve their own cohort line?',
  },
  cac: {
    endpoint: 'fin_cac_by_channel',
    title: 'Spend, CAC and payback',
    posthog: 'Spend and revenue are two sources joined in one query. Both sync into PostHog, next to the product data you would want to cut them by.',
    what: 'Spend, new subscribers, CAC and payback per channel.',
    you: 'Where does spend live today, and who joins it to revenue?',
  },
  investor: {
    endpoint: 'fin_investor_quarterly',
    title: 'Investor pack',
    posthog: 'Same ledger as the daily numbers, so there is no separate investor model to reconcile. The page is yours (your domain, your login), only the numbers come from PostHog.',
    what: 'The quarterly view: ARR, net new ARR, subscribers.',
    you: 'How long does it take to pull numbers for a board meeting?',
  },
  failures: {
    endpoint: 'fin_payment_failures_weekly',
    title: 'Payment failures',
    posthog: 'A billing export cannot show you this. A failed checkout never becomes an invoice, it only exists as a product event, and those are already in PostHog.',
    what: 'Real HogFlix events: failed Ultimate checkouts per week.',
    you: 'What hits revenue in the product before finance sees it?',
  },
  stripe: {
    endpoint: 'revenue_summary',
    title: 'Stripe via the data warehouse',
    posthog: 'This is how it works for real. Stripe syncs in on a schedule and sits next to the product events. The big MRR numbers in this demo are made up, this one is not.',
    what: 'A real Stripe sandbox synced into PostHog. Small numbers, it is a test account.',
    you: 'Where does billing truth live: Stripe, your warehouse, somewhere else?',
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
  { id: 'wiring', name: 'How it is wired', title: 'How it is wired', lede: 'Why this runs in PostHog, what runs where, and what this app can see.' },
];
