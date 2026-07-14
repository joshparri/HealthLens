import test from 'node:test'
import assert from 'node:assert'

process.env.HEALTHLENS_SYNC_SECRET = 'test-secret'
const { default: handler, createSyncHandler, buildSummaryRow } = await import('../src/apiHandlers/sync-health-connect.js')

function createResponse() {
  const res = { statusCode: 200, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  return res
}

function createFakeSupabase(options = {}) {
  const state = {
    imports: options.imports ? [...options.imports] : [],
    summaries: options.summaries ? [...options.summaries] : [],
    nextImport: 1,
    nextSummary: 1,
  }

  class Builder {
    constructor(table) {
      this.table = table
      this.action = 'select'
      this.filters = []
      this.payload = null
      this.limitValue = null
      this.singleValue = false
    }

    select() { return this }
    limit(value) { this.limitValue = value; return this }
    eq(column, value) { this.filters.push({ column, value }); return this }
    single() { this.singleValue = true; return this.execute() }
    insert(payload) { this.action = 'insert'; this.payload = payload; return this }
    delete() { this.action = 'delete'; return this }
    then(resolve, reject) { return this.execute().then(resolve, reject) }

    rows() {
      return this.table === 'health_sync_imports' ? state.imports : state.summaries
    }

    matches(row) {
      return this.filters.every(filter => row[filter.column] === filter.value)
    }

    async execute() {
      const rows = this.rows()

      if (this.action === 'select') {
        let data = rows.filter(row => this.matches(row))
        if (this.limitValue != null) data = data.slice(0, this.limitValue)
        return { data, error: null }
      }

      if (this.action === 'insert') {
        if (this.table === 'daily_health_summary' && options.failSummaryInsert) {
          return { data: null, error: { message: 'summary insert failed' } }
        }

        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload]
        const inserted = incoming.map(row => ({
          id: this.table === 'health_sync_imports'
            ? `import-${state.nextImport++}`
            : `summary-${state.nextSummary++}`,
          ...row,
        }))

        rows.push(...inserted)
        return { data: this.singleValue ? inserted[0] : inserted, error: null }
      }

      if (this.action === 'delete') {
        const kept = rows.filter(row => !this.matches(row))
        const deleted = rows.filter(row => this.matches(row))
        if (this.table === 'health_sync_imports') state.imports = kept
        if (this.table === 'daily_health_summary') state.summaries = kept
        return { data: deleted, error: null }
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

function validRequest(overrides = {}) {
  return {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret' },
    body: {
      deviceIdHash: 'test-device',
      dateRange: { start: '2026-01-01', end: '2026-01-01' },
      dailySummaries: [
        {
          date: '2026-01-01',
          steps: 0,
          sleep_minutes: 0,
          exercise_minutes: 0,
          source_confidence: 0,
          sources: { android: true },
        },
      ],
      ...overrides,
    },
  }
}

test('sync endpoint rejects missing auth', async () => {
  const req = {
    method: 'POST',
    headers: {},
    body: {
      deviceIdHash: 'abc',
      dateRange: { start: '2026-01-01', end: '2026-01-02' },
      dailySummaries: [],
    },
  }
  const res = createResponse()
  await handler(req, res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'Missing Authorization header')
})

test('sync endpoint rejects wrong auth', async () => {
  const req = {
    method: 'POST',
    headers: { Authorization: 'Bearer wrong-token' },
    body: {
      deviceIdHash: 'abc',
      dateRange: { start: '2026-01-01', end: '2026-01-02' },
      dailySummaries: [],
    },
  }
  const res = createResponse()
  await handler(req, res)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Invalid sync token')
})

test('buildSummaryRow preserves zero values', () => {
  const row = buildSummaryRow(validRequest().body.dailySummaries[0], validRequest().body, 'import-1', 'user-1')

  assert.equal(row.steps, 0)
  assert.equal(row.sleep_minutes, 0)
  assert.equal(row.exercise_minutes, 0)
  assert.equal(row.source_confidence, 0)
})

test('sync endpoint accepts valid fake payload and writes import plus summary', async () => {
  const fake = createFakeSupabase()
  const testHandler = createSyncHandler({
    supabaseClient: fake.client,
    env: { HEALTHLENS_SYNC_SECRET: 'test-secret', DEFAULT_USER_ID: 'user-1' },
  })

  const res = createResponse()
  await testHandler(validRequest(), res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.recordsReceived, 1)
  assert.equal(fake.state.imports.length, 1)
  assert.equal(fake.state.summaries.length, 1)
  assert.equal(fake.state.summaries[0].steps, 0)
})

test('sync endpoint is idempotent for same device and date range', async () => {
  const fake = createFakeSupabase({
    imports: [{
      id: 'existing-import',
      user_id: 'user-1',
      device_id_hash: 'test-device',
      date_range_start: '2026-01-01',
      date_range_end: '2026-01-01',
    }],
  })
  const testHandler = createSyncHandler({
    supabaseClient: fake.client,
    env: { HEALTHLENS_SYNC_SECRET: 'test-secret', DEFAULT_USER_ID: 'user-1' },
  })

  const res = createResponse()
  await testHandler(validRequest(), res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.importId, 'existing-import')
  assert.equal(res.body.recordsReceived, 0)
  assert.equal(fake.state.summaries.length, 0)
})

test('sync endpoint cleans up import if summary insert fails', async () => {
  const fake = createFakeSupabase({ failSummaryInsert: true })
  const testHandler = createSyncHandler({
    supabaseClient: fake.client,
    env: { HEALTHLENS_SYNC_SECRET: 'test-secret', DEFAULT_USER_ID: 'user-1' },
  })

  const res = createResponse()
  const originalError = console.error
  console.error = () => {}
  try {
    await testHandler(validRequest(), res)
  } finally {
    console.error = originalError
  }

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'Failed to record daily summaries')
  assert.equal(fake.state.imports.length, 0)
})
