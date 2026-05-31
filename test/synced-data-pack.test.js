import test from 'node:test'
import assert from 'node:assert'
import { buildSyncedDataPack } from '../src/lib/syncedDataPack.js'

test('buildSyncedDataPack creates an evidence pack from Supabase rows', () => {
  const pack = buildSyncedDataPack([
    { date: '2026-05-30', steps: 0, sleep_minutes: 0, hrv_rmssd: 40, warnings_json: ['rest day'] },
    { date: '2026-05-31', steps: 8000, sleep_minutes: 420, hrv_rmssd: 44 },
  ], { selectedDays: 7 })

  assert.equal(pack.name, 'supabase-synced-data-7d.md')
  assert.equal(pack.type, 'supabase')
  assert.match(pack.summary, /DATA PACK: SUPABASE SYNCED DAILY HEALTH SUMMARY/)
  assert.match(pack.summary, /steps: 8000/)
  assert.match(pack.summary, /2026-05-30, 0, 0/)
  assert.match(pack.summary, /rest day/)
})

test('buildSyncedDataPack handles empty rows', () => {
  const pack = buildSyncedDataPack([], { selectedDays: 30 })

  assert.equal(pack.name, 'supabase-synced-data-30d.md')
  assert.match(pack.summary, /No synced health data/)
})
