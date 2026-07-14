import test from 'node:test'
import assert from 'node:assert'
import { createStravaWebhookHandler } from '../src/apiHandlers/strava-webhook.js'
import {
  markStravaActivityDeleted,
  mapStravaActivityToRows,
  upsertStravaActivityToSupabase,
} from '../src/apiLib/stravaClient.js'

function createResponse() {
  const res = { statusCode: 200, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  res.send = (payload) => { res.body = payload; return res }
  return res
}

function createFakeSupabase(seed = {}) {
  const state = {
    oauth_tokens: seed.oauth_tokens ? [...seed.oauth_tokens] : [],
    strava_activities: seed.strava_activities ? [...seed.strava_activities] : [],
    exercise_sessions: seed.exercise_sessions ? [...seed.exercise_sessions] : [],
    heart_metrics: seed.heart_metrics ? [...seed.heart_metrics] : [],
    strava_webhook_events: seed.strava_webhook_events ? [...seed.strava_webhook_events] : [],
    nextId: 1,
  }

  class Builder {
    constructor(table) {
      this.table = table
      this.action = 'select'
      this.payload = null
      this.filters = []
      this.limitValue = null
      this.singleValue = false
      this.conflict = null
    }

    select() { return this }
    limit(value) { this.limitValue = value; return this }
    eq(column, value) { this.filters.push({ column, value }); return this }
    single() { this.singleValue = true; return this.execute() }
    insert(payload) { this.action = 'insert'; this.payload = payload; return this }
    upsert(payload, options = {}) { this.action = 'upsert'; this.payload = payload; this.conflict = options.onConflict; return this }
    update(payload) { this.action = 'update'; this.payload = payload; return this }
    then(resolve, reject) { return this.execute().then(resolve, reject) }

    rows() {
      return state[this.table]
    }

    matches(row) {
      return this.filters.every((filter) => row[filter.column] === filter.value)
    }

    conflictColumns() {
      return String(this.conflict || 'id').split(',').map((part) => part.trim()).filter(Boolean)
    }

    withId(row) {
      return row.id ? row : { id: `${this.table}-${state.nextId++}`, ...row }
    }

    async execute() {
      const rows = this.rows()

      if (this.action === 'select') {
        let data = rows.filter((row) => this.matches(row))
        if (this.limitValue != null) data = data.slice(0, this.limitValue)
        if (this.singleValue) data = data[0] || null
        return { data, error: null }
      }

      if (this.action === 'insert') {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload]
        const inserted = incoming.map((row) => this.withId({ ...row }))
        rows.push(...inserted)
        return { data: this.singleValue ? inserted[0] : inserted, error: null }
      }

      if (this.action === 'upsert') {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload]
        const cols = this.conflictColumns()
        const output = incoming.map((row) => {
          const existing = rows.find((candidate) => cols.every((col) => candidate[col] === row[col]))
          if (existing) {
            Object.assign(existing, row)
            return existing
          }
          const inserted = this.withId({ ...row })
          rows.push(inserted)
          return inserted
        })
        return { data: this.singleValue ? output[0] : output, error: null }
      }

      if (this.action === 'update') {
        const updated = rows.filter((row) => this.matches(row))
        updated.forEach((row) => Object.assign(row, this.payload))
        return { data: this.singleValue ? updated[0] : updated, error: null }
      }

      return { data: null, error: null }
    }
  }

  return {
    state,
    client: {
      from(table) {
        return new Builder(table)
      },
    },
  }
}

const activity = {
  id: 123456,
  name: 'Morning Ride',
  sport_type: 'Ride',
  type: 'Ride',
  start_date: '2026-05-31T06:00:00Z',
  start_date_local: '2026-05-31T16:00:00Z',
  timezone: '(GMT+10:00) Australia/Sydney',
  distance: 15123.4,
  moving_time: 2520,
  elapsed_time: 2700,
  total_elevation_gain: 210,
  average_speed: 6,
  max_speed: 14,
  average_heartrate: 132,
  max_heartrate: 171,
  calories: 650,
  private: false,
  trainer: false,
  commute: false,
}

test('Strava activity maps to exercise-only rows', () => {
  const rows = mapStravaActivityToRows(activity, { userId: 'user-1' })

  assert.equal(rows.stravaActivityRow.strava_activity_id, '123456')
  assert.equal(rows.exerciseRow.external_id, 'strava:123456')
  assert.equal(rows.exerciseRow.source_name, 'strava')
  assert.equal(rows.exerciseRow.steps, null)
  assert.equal(rows.exerciseRow.avg_hr, 132)
  assert.equal(rows.exerciseRow.raw_json.exercise_source_only, true)
  assert.equal(rows.heartMetricRows.length, 2)
})

test('duplicate Strava activity upsert does not duplicate rows', async () => {
  const fake = createFakeSupabase()

  await upsertStravaActivityToSupabase(activity, null, {
    supabaseClient: fake.client,
    env: { DEFAULT_USER_ID: 'user-1' },
  })
  await upsertStravaActivityToSupabase({ ...activity, name: 'Morning Ride Updated' }, null, {
    supabaseClient: fake.client,
    env: { DEFAULT_USER_ID: 'user-1' },
  })

  assert.equal(fake.state.strava_activities.length, 1)
  assert.equal(fake.state.exercise_sessions.length, 1)
  assert.equal(fake.state.heart_metrics.length, 2)
  assert.equal(fake.state.strava_activities[0].name, 'Morning Ride Updated')
})

test('deleted Strava activity is marked deleted in activity and exercise tables', async () => {
  const fake = createFakeSupabase()
  await upsertStravaActivityToSupabase(activity, null, {
    supabaseClient: fake.client,
    env: { DEFAULT_USER_ID: 'user-1' },
  })

  await markStravaActivityDeleted('123456', { supabaseClient: fake.client })

  assert.ok(fake.state.strava_activities[0].deleted_at)
  assert.ok(fake.state.exercise_sessions[0].deleted_at)
})

test('Strava webhook GET validation returns challenge', async () => {
  const handler = createStravaWebhookHandler({
    supabaseClient: createFakeSupabase().client,
    env: { STRAVA_VERIFY_TOKEN: 'verify-me', STRAVA_WEBHOOK_PROCESS_INLINE: 'false' },
  })
  const req = {
    method: 'GET',
    query: { 'hub.verify_token': 'verify-me', 'hub.challenge': 'challenge-123' },
    headers: {},
  }
  const res = createResponse()

  await handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { 'hub.challenge': 'challenge-123' })
})

test('Strava webhook rejects wrong verify token', async () => {
  const handler = createStravaWebhookHandler({
    supabaseClient: createFakeSupabase().client,
    env: { STRAVA_VERIFY_TOKEN: 'verify-me' },
  })
  const req = {
    method: 'GET',
    query: { 'hub.verify_token': 'wrong', 'hub.challenge': 'challenge-123' },
    headers: {},
  }
  const res = createResponse()

  await handler(req, res)

  assert.equal(res.statusCode, 403)
})

test('Strava webhook POST stores event without inline processing', async () => {
  const fake = createFakeSupabase()
  const handler = createStravaWebhookHandler({
    supabaseClient: fake.client,
    env: { STRAVA_VERIFY_TOKEN: 'verify-me', STRAVA_WEBHOOK_PROCESS_INLINE: 'false' },
  })
  const req = {
    method: 'POST',
    headers: {},
    body: {
      object_type: 'activity',
      object_id: 123456,
      aspect_type: 'create',
      owner_id: 777,
      subscription_id: 999,
      event_time: 1780000000,
      updates: { title: 'Morning Ride' },
    },
  }
  const res = createResponse()

  await handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(fake.state.strava_webhook_events.length, 1)
  assert.equal(fake.state.strava_webhook_events[0].object_id, '123456')
  assert.equal(fake.state.strava_webhook_events[0].processed, false)
})

test('Strava webhook delete event marks synced activity deleted', async () => {
  const fake = createFakeSupabase()
  await upsertStravaActivityToSupabase(activity, null, {
    supabaseClient: fake.client,
    env: { DEFAULT_USER_ID: 'user-1' },
  })
  const handler = createStravaWebhookHandler({
    supabaseClient: fake.client,
    env: { STRAVA_VERIFY_TOKEN: 'verify-me' },
  })
  const req = {
    method: 'POST',
    headers: {},
    body: {
      object_type: 'activity',
      object_id: 123456,
      aspect_type: 'delete',
      owner_id: 777,
      subscription_id: 999,
      event_time: 1780000000,
      updates: {},
    },
  }
  const res = createResponse()

  await handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(fake.state.strava_webhook_events[0].processed, true)
  assert.ok(fake.state.strava_activities[0].deleted_at)
  assert.ok(fake.state.exercise_sessions[0].deleted_at)
})
