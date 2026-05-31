import test from 'node:test'
import assert from 'node:assert'
import { summarizeDailyRows, parseWarnings } from '../src/lib/supabaseSummary.js'

test('summarizeDailyRows returns null for no Supabase rows', () => {
  assert.equal(summarizeDailyRows([]), null)
})

test('summarizeDailyRows preserves zero values and computes totals/averages', () => {
  const summary = summarizeDailyRows([
    {
      date: '2026-05-30',
      steps: 0,
      sleep_minutes: 0,
      hrv_rmssd: 40,
      resting_hr: 60,
      source_confidence: 0,
      warnings_json: ['zero day is real'],
    },
    {
      date: '2026-05-31',
      steps: 8000,
      sleep_minutes: 420,
      hrv_rmssd: 44,
      resting_hr: 58,
      source_confidence: 0.8,
      warnings_json: JSON.stringify(['source overlap']),
    },
  ])

  assert.equal(summary.totals.steps, 8000)
  assert.equal(summary.totals.sleep_minutes, 420)
  assert.equal(summary.averages.hrv_rmssd, 42)
  assert.equal(summary.averages.resting_hr, 59)
  assert.equal(summary.averages.source_confidence, 0.4)
  assert.deepEqual(summary.warnings, ['zero day is real', 'source overlap'])
  assert.equal(summary.chartRows[0].steps, 0)
  assert.equal(summary.chartRows[0].sleep_hours, 0)
})

test('parseWarnings handles invalid warning payloads without crashing', () => {
  assert.deepEqual(parseWarnings([{ warnings_json: 'not-json-but-useful' }]), ['not-json-but-useful'])
})
