import test from 'node:test'
import assert from 'node:assert'

process.env.HEALTHLENS_SYNC_SECRET = 'test-secret'
const { default: handler } = await import('../api/sync/health-connect.js')

function createResponse() {
  const res = { statusCode: 200, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  return res
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
