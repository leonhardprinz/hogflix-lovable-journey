// Scores-only offline evals: the judge runs here, only scores and an opaque hash reach PostHog.
// Run from the repo root: set -a; . ./.env; set +a; node scripts/offline-evals-demo/run.mjs
import { createHash } from 'node:crypto'
import { EvaluationItem, OfflineEvaluations } from '@posthog/ai/evaluations'

// Synthetic email pairs. These stay in this process and are never uploaded.
const PAIRS = [
  ['Hi Sam, Thursday at 3pm works for me. See you then.', 'Hi Sam, Thursday at 3pm works for me. See you then.'],
  ['Thanks for the invoice, I will pay it this week.', 'Thanks for the invoice, I will pay it this week.'],
  ['Happy to join the kickoff, please send the agenda.', 'Happy to join the kickoff, please send the agenda over.'],
  ['Could we move our call to Monday morning?', 'Could we move our call to Monday morning instead?'],
  ['Thanks for the intro, I will reach out to Maya today.', 'Thanks for the intro, reaching out to Maya today.'],
  ['The contract looks good, I will sign it tomorrow.', 'Contract looks good, signing tomorrow.'],
  ['I reviewed the proposal and have a few questions about pricing.', 'Reviewed the proposal, one question about pricing for the second year.'],
  ['We can ship the update next week if QA passes.', 'We should be able to ship next Tuesday, QA is nearly done.'],
  ['Sorry for the delay, the report is attached.', 'Apologies, here is the report, the numbers on page two changed.'],
  ['Great to meet you yesterday, let us stay in touch.', 'Lovely meeting you, can you send the slides you mentioned?'],
  ['I am out of office until Friday.', 'Back on Monday, please talk to Priya about the renewal until then.'],
  ['Please find the updated budget below.', 'Hold off on the budget for now, finance is still reviewing it.'],
]

const tokens = (s) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? [])
const similarity = (a, b) => {
  const [x, y] = [tokens(a), tokens(b)]
  const shared = [...x].filter((t) => y.has(t)).length
  return Number((shared / Math.sqrt(x.size * y.size)).toFixed(3))
}

const ev = new OfflineEvaluations({
  projectId: Number(process.env.POSTHOG_PROJECT_ID),
  secretKey: process.env.POSTHOG_PERSONAL_API_KEY,
  host: process.env.POSTHOG_HOST,
})

const scorer = async (name, kind, config) => {
  const page = await ev.scorers.list({ search: name })
  const found = (page.results ?? page.items ?? []).find((s) => s.name === name)
  if (found) return found
  return ev.scorers.create({ name, kind, config })
}

try {
  const sim = await scorer('Draft similarity', 'numeric', { min: 0, max: 1, passingRule: { operator: 'gte', threshold: 0.6 } })
  const accepted = await scorer('Draft sent as written', 'boolean', { trueIsFailure: false })
  const exp = await ev.createExperiment({
    name: 'Draft quality, scores only',
    suiteKey: 'draft-quality-scores-only',
    runSource: 'local',
    modelVersion: 'demo-draft-model',
    expectedItemCount: PAIRS.length,
    expectedResultCount: PAIRS.length * 2,
  })
  for (const [i, [draft, sent]] of PAIRS.entries()) {
    const caseKey = createHash('sha256').update(`thread-${i}`).digest('hex').slice(0, 16)
    const item = new EvaluationItem({ caseKey })
    if (i === 0) console.log('item as uploaded:', item.toJSONString())
    await exp.uploadResult({ item, scorerVersionId: sim.currentVersionId, value: similarity(draft, sent) })
    await exp.uploadResult({ item, scorerVersionId: accepted.currentVersionId, value: draft === sent })
  }
  await exp.complete()
  console.log(`Completed ${exp.id}`)
  console.log(`${process.env.POSTHOG_HOST}/project/${process.env.POSTHOG_PROJECT_ID}/ai-evals/evaluations/offline/experiments`)
} finally {
  ev.close()
}
