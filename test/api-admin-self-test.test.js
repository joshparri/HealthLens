import test from 'node:test'
import assert from 'node:assert'

process.env.HEALTHLENS_SYNC_SECRET = 'test-secret'
const { default: handler } = await import('../api/admin/self-test.js')

function createResponse() {
  const res = { statusCode: 200, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  return res
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
