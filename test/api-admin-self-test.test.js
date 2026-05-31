import test from 'node:test'
import assert from 'node:assert'

process.env.HEALTHLENS_SYNC_SECRET = 'test-secret'
const { default: handler, createAdminSelfTestHandler } = await import('../api/admin/self-test.js')

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
      this.inFilters = []
      this.payload = null
      this.limitValue = null
      this.singleValue = false
    }

    select() { return this }
    limit(value) { this.limitValue = value; return this }
    eq(column, value) { this.filters.push({ column, value }); return this }
    in(column, values) { this.inFilters.push({ column, values }); return this }
    single() { this.singleValue = true; return this.execute() }
    insert(payload) { this.action = 'insert'; this.payload = payload; return this }
    delete() { this.action = 'delete'; return this }
    then(resolve, reject) { return this.execute().then(resolve, reject) }

    rows() {
      return this.table === 'health_sync_imports' ? state.imports : state.summaries
    }

    matches(row) {
      return this.filters.every(filter => row[filter.column] === filter.value) &&
        this.inFilters.every(filter => filter.values.includes(row[filter.column]))
    }

    async execute() {
      const rows = this.rows()

      if (this.action === 'select') {
        let data = rows.filter(row => this.matches(row))
        if (this.limitValue != null) data = data.slice(0, this.limitValue)
        if (this.singleValue) data = data[0] || null
        return { data, error: null }
      }

      if (this.action === 'insert') {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload]

        if (this.table === 'health_sync_imports') {
          const duplicate = incoming.some(row =>
            state.imports.some(existing =>
              existing.user_id === row.user_id &&
              existing.device_id_hash === row.device_id_hash &&
              existing.date_range_start === row.date_range_start &&
              existing.date_range_end === row.date_range_end
            )
          )
          if (duplicate) return { data: null, error: { message: 'unique constraint violation' } }
        }

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

function envWithSupabase() {
  return {
    HEALTHLENS_SYNC_SECRET: 'test-secret',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
    SUPABASE_URL: 'https://example.supabase.co',
    DEFAULT_USER_ID: 'user-1',
  }
}

test('admin self-test rejects missing auth', async () => {
  const req = { method: 'POST', headers: {}, body: {} }
  const res = createResponse()
  await handler(req, res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'Missing Authorization header')
})

test('admin self-test rejects wrong auth', async () => {
  const req = { method: 'POST', headers: { Authorization: 'Bearer wrong-token' }, body: {} }
  const res = createResponse()
  await handler(req, res)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Invalid admin token')
})

test('admin self-test service role unavailable reports false', async () => {
  process.env.HEALTHLENS_SYNC_SECRET = 'test-secret'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.VITE_SUPABASE_URL

  const req = { method: 'POST', headers: { Authorization: 'Bearer test-secret' }, body: { cleanupImportId: '00000000-0000-0000-0000-000000000000' } }
  const res = createResponse()
  await handler(req, res)

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.checks.serviceRoleAvailable, false)
  assert.equal(res.body.error, 'Supabase service role is unavailable')
})

test('admin self-test inserts, verifies idempotency, and cleans up fake rows', async () => {
  const fake = createFakeSupabase()
  const testHandler = createAdminSelfTestHandler({
    supabaseClient: fake.client,
    env: envWithSupabase(),
  })

  const req = { method: 'POST', headers: { Authorization: 'Bearer test-secret' }, body: {} }
  const res = createResponse()
  await testHandler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.ok, true)
  assert.deepEqual(res.body.checks, {
    serviceRoleAvailable: true,
    insertImport: true,
    insertSummary: true,
    queryImport: true,
    querySummary: true,
    idempotency: true,
    cleanup: true,
  })
  assert.equal(res.body.createdRows.health_sync_imports, 1)
  assert.equal(res.body.createdRows.daily_health_summary, 1)
  assert.equal(res.body.deletedRows.health_sync_imports, 1)
  assert.equal(res.body.deletedRows.daily_health_summary, 1)
  assert.equal(fake.state.imports.length, 0)
  assert.equal(fake.state.summaries.length, 0)
})

test('admin self-test cleanup deletes only explicit test imports', async () => {
  const fake = createFakeSupabase({
    imports: [{
      id: 'import-1',
      user_id: 'user-1',
      source: 'self_test',
      sync_type: 'self_test',
      device_id_hash: 'self-test-device',
    }],
    summaries: [{
      id: 'summary-1',
      user_id: 'user-1',
      date: '2026-05-30',
      import_id: 'import-1',
    }],
  })
  const testHandler = createAdminSelfTestHandler({
    supabaseClient: fake.client,
    env: envWithSupabase(),
  })

  const req = {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret' },
    body: { cleanupDeviceIdHash: 'self-test-device' },
  }
  const res = createResponse()
  await testHandler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.deletedRows.health_sync_imports, 1)
  assert.equal(res.body.deletedRows.daily_health_summary, 1)
  assert.equal(fake.state.imports.length, 0)
  assert.equal(fake.state.summaries.length, 0)
})

test('admin self-test cleanup blocks non-test imports', async () => {
  const fake = createFakeSupabase({
    imports: [{
      id: 'import-1',
      user_id: 'user-1',
      source: 'android',
      sync_type: 'health_connect',
      device_id_hash: 'real-device',
    }],
  })
  const testHandler = createAdminSelfTestHandler({
    supabaseClient: fake.client,
    env: envWithSupabase(),
  })

  const req = {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret' },
    body: { cleanupDeviceIdHash: 'real-device' },
  }
  const res = createResponse()
  await testHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Cleanup only allowed for explicit test imports or test device IDs')
  assert.equal(fake.state.imports.length, 1)
})
