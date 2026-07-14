import { spawnSync } from 'node:child_process'
import { checkHealth } from '../src/lib/claudeApi.js'

const DEFAULT_APP_URL = 'https://health-lens-rust.vercel.app'
const DEFAULT_SYNC_ENDPOINT = `${DEFAULT_APP_URL}/api/sync/health-connect`
const DEFAULT_ADMIN_ENDPOINT = `${DEFAULT_APP_URL}/api/admin/self-test`
const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const runSync = args.has('--sync') || Boolean(process.env.HEALTHLENS_SYNC_SECRET)
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return { ok: result.status === 0, status: result.status }
}

async function checkUrl(name, url, expectedStatus, options = {}) {
  try {
    const response = await fetch(url, options)
    record(name, response.status === expectedStatus, `HTTP ${response.status}`)
  } catch (error) {
    record(name, false, error.message)
  }
}

async function checkProvider(name, provider, model, key) {
  if (!key) {
    record(`${name} provider health`, true, 'skipped; env key not set')
    return
  }
  const result = await checkHealth({ provider, model, apiKey: key })
  record(`${name} provider health`, result.ok, result.ok ? model : result.message.split('\n')[0])
}

async function sendFakeSync({ cleanup = false } = {}) {
  const secret = process.env.HEALTHLENS_SYNC_SECRET
  if (!secret) {
    record(cleanup ? 'Production fake sync cleanup' : 'Production fake sync', true, 'skipped; HEALTHLENS_SYNC_SECRET not set')
    return
  }

  const endpoint = cleanup
    ? (process.env.HEALTHLENS_ADMIN_ENDPOINT || DEFAULT_ADMIN_ENDPOINT)
    : (process.env.HEALTHLENS_SYNC_ENDPOINT || DEFAULT_SYNC_ENDPOINT)

  const date = new Date().toISOString().slice(0, 10)
  const body = cleanup
    ? { cleanupDeviceIdHash: 'test-device-sync' }
    : {
        deviceIdHash: 'test-device-sync',
        dateRange: { start: date, end: date },
        dailySummaries: [{
          date,
          timezone: 'UTC',
          steps: 8200,
          calories_total: 2130,
          source_confidence: 0.92,
          resting_hr: 58,
          hrv_rmssd: 42,
          respiratory_rate: 15.4,
          weight_kg: 77.2,
          sleep_minutes: 430,
          exercise_minutes: 38,
          distance_m: 6200,
          active_minutes: 65,
          sources: { doctor: true },
          warnings: ['HealthLens doctor fake sync row'],
        }],
        syncStartedAt: new Date().toISOString(),
        appVersion: 'HealthLensDoctor/1.0.0',
      }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    let detail = `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed.ok === true) detail += ', ok=true'
      if (parsed.recordsReceived != null) detail += `, recordsReceived=${parsed.recordsReceived}`
      if (parsed.deletedRows) detail += `, deletedImports=${parsed.deletedRows.health_sync_imports ?? 0}`
      if (parsed.error) detail += `, error=${parsed.error}`
    } catch {
      if (text) detail += `, ${text.slice(0, 80)}`
    }
    record(cleanup ? 'Production fake sync cleanup' : 'Production fake sync', response.ok, detail)
  } catch (error) {
    record(cleanup ? 'Production fake sync cleanup' : 'Production fake sync', false, error.message)
  }
}

console.log('HealthLens doctor starting...\n')
record('Node runtime', Number(process.versions.node.split('.')[0]) >= 18, `v${process.versions.node}`)

if (!skipBuild) {
  const test = run('npm', ['test'])
  record('npm test', test.ok, test.ok ? 'passed' : `failed (${test.status})`)

  const build = run('npm', ['run', 'build'])
  record('npm run build', build.ok, build.ok ? 'passed' : `failed (${build.status})`)
} else {
  record('npm test/build', true, 'skipped by --skip-build')
}

await checkUrl('Live app', process.env.HEALTHLENS_APP_URL || DEFAULT_APP_URL, 200, { method: 'HEAD' })
await checkUrl('Sync endpoint auth boundary', process.env.HEALTHLENS_SYNC_ENDPOINT || DEFAULT_SYNC_ENDPOINT, 401, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceIdHash: 'doctor-probe',
    dateRange: { start: '2026-05-31', end: '2026-05-31' },
    dailySummaries: [],
  }),
})

await checkProvider('Groq', 'groq', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', process.env.GROQ_API_KEY)
await checkProvider('OpenRouter', 'openrouter', process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', process.env.OPENROUTER_API_KEY)
await checkProvider('Anthropic', 'anthropic', process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', process.env.ANTHROPIC_API_KEY)

if (runSync) {
  await sendFakeSync()
  if (args.has('--cleanup')) await sendFakeSync({ cleanup: true })
} else {
  record('Production fake sync', true, 'skipped; set HEALTHLENS_SYNC_SECRET or pass --sync')
}

const failed = results.filter((result) => !result.ok)
console.log('\nSummary')
console.log(`${results.length - failed.length}/${results.length} checks passed`)

if (failed.length) {
  console.log('\nFailed checks:')
  failed.forEach((result) => console.log(`- ${result.name}: ${result.detail}`))
  process.exit(1)
}
