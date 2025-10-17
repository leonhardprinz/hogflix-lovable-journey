// scripts/backfill/backfill.js
// Backfill synthetic traffic into the past using server-side /capture.
// Accepts both POSTHOG_* and PH_* envs (your repo uses PH_PROJECT_API_KEY / PH_HOST).

import { request as httpsRequest } from 'node:https'

const POSTHOG_HOST =
  process.env.POSTHOG_HOST ||
  process.env.PH_HOST ||
  'https://eu.i.posthog.com'

const POSTHOG_API_KEY =
  process.env.POSTHOG_API_KEY ||
  process.env.PH_PROJECT_API_KEY

const START_DATE = process.env.START_DATE || '2025-10-01'   // inclusive, UTC
const END_DATE   = process.env.END_DATE   || '2025-10-16'   // inclusive, UTC
const PERSONAS   = Number(process.env.PERSONAS || 400)
const AVG_EVENTS_PER_ACTIVE_DAY = Number(process.env.AVG_EVENTS_PER_ACTIVE_DAY || 6)
const DRY_RUN = String(process.env.DRY_RUN || 'false') === 'true'

if (!POSTHOG_API_KEY && !DRY_RUN) {
  console.error('Missing POSTHOG_API_KEY/PH_PROJECT_API_KEY (set in GitHub Secrets). Or set DRY_RUN=true to test.')
  process.exit(1)
}

const rand = (n) => Math.floor(Math.random() * n)
const choice = (arr) => arr[rand(arr.length)]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isoAt(dateObj, h, m, s) {
  const d = new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    h, m, s, rand(900)
  ))
  return d.toISOString()
}

function* daysInclusive(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield new Date(d)
  }
}

function capture(event, properties, distinct_id, timestampIso) {
  const payload = JSON.stringify({
    api_key: POSTHOG_API_KEY,
    event,
    properties: {
      ...properties,
      synthetic: true,
      i
