const DEFAULT_ENDPOINT = 'https://health-lens-rust.vercel.app/api/sync/health-connect'
const DEFAULT_ADMIN_ENDPOINT = 'https://health-lens-rust.vercel.app/api/admin/self-test'
const args = process.argv.slice(2)
const deleteTestData = args.includes('--delete-test-data')
const dateArg = args.find((arg) => arg.startsWith('--date='))
const date = dateArg ? dateArg.split('=')[1] : new Date().toISOString().slice(0, 10)
const endpoint = process.env.HEALTHLENS_SYNC_ENDPOINT || DEFAULT_ENDPOINT
const adminEndpoint = process.env.HEALTHLENS_ADMIN_ENDPOINT || DEFAULT_ADMIN_ENDPOINT
const secret = process.env.HEALTHLENS_SYNC_SECRET

if (!secret) {
  console.error('ERROR: HEALTHLENS_SYNC_SECRET must be set in the environment.')
  process.exit(1)
}

const deviceIdHash = 'test-device-sync'

async function sendSync() {
  const payload = {
    deviceIdHash,
    dateRange: { start: date, end: date },
    dailySummaries: [
      {
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
        sources: { android: true },
      },
    ],
    syncStartedAt: new Date().toISOString(),
    appVersion: 'HealthLensSync/0.1.0',
  }

  console.log(`Sending fake sync payload to ${endpoint}`)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  })

  const body = await response.text()
  console.log(`Status: ${response.status}`)
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2))
  } catch {
    console.log(body)
  }
}

async function cleanupTestData() {
  console.log(`Requesting test cleanup from ${adminEndpoint}`)
  const payload = {
    cleanupDeviceIdHash: deviceIdHash,
  }

  const response = await fetch(adminEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  })

  const body = await response.text()
  console.log(`Status: ${response.status}`)
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2))
  } catch {
    console.log(body)
  }
}

if (deleteTestData) {
  cleanupTestData().catch((error) => {
    console.error('Cleanup error:', error.message)
    process.exit(1)
  })
} else {
  sendSync().catch((error) => {
    console.error('Sync error:', error.message)
    process.exit(1)
  })
}
