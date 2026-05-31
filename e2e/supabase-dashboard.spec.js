import { expect, test } from '@playwright/test'

const summaries = [
  { id: 'day-1', date: '2026-05-25', timezone: 'UTC', steps: 4200, sleep_minutes: 390, hrv_rmssd: 28, resting_hr: 64, respiratory_rate: 15.4, weight_kg: 70.1, exercise_minutes: 12, source_confidence: 0.74, warnings_json: '[]', import_id: 'import-1' },
  { id: 'day-2', date: '2026-05-26', timezone: 'UTC', steps: 6100, sleep_minutes: 430, hrv_rmssd: 31, resting_hr: 62, respiratory_rate: 15.1, weight_kg: 70.0, exercise_minutes: 22, source_confidence: 0.78, warnings_json: '[]', import_id: 'import-1' },
  { id: 'day-3', date: '2026-05-27', timezone: 'UTC', steps: 9800, sleep_minutes: 455, hrv_rmssd: 35, resting_hr: 60, respiratory_rate: 14.9, weight_kg: 69.8, exercise_minutes: 44, source_confidence: 0.82, warnings_json: '["Missing respiratory-rate source on one day"]', import_id: 'import-1' },
  { id: 'day-4', date: '2026-05-28', timezone: 'UTC', steps: 7300, sleep_minutes: 410, hrv_rmssd: 30, resting_hr: 63, respiratory_rate: 15.3, weight_kg: 69.9, exercise_minutes: 18, source_confidence: 0.77, warnings_json: '[]', import_id: 'import-1' },
  { id: 'day-5', date: '2026-05-29', timezone: 'UTC', steps: 11200, sleep_minutes: 480, hrv_rmssd: 38, resting_hr: 58, respiratory_rate: 14.6, weight_kg: 69.7, exercise_minutes: 51, source_confidence: 0.86, warnings_json: '[]', import_id: 'import-1' },
  { id: 'day-6', date: '2026-05-30', timezone: 'UTC', steps: 8400, sleep_minutes: 425, hrv_rmssd: 33, resting_hr: 61, respiratory_rate: 15.0, weight_kg: 69.8, exercise_minutes: 30, source_confidence: 0.81, warnings_json: '[]', import_id: 'import-1' },
  { id: 'day-7', date: '2026-05-31', timezone: 'UTC', steps: 10100, sleep_minutes: 465, hrv_rmssd: 36, resting_hr: 59, respiratory_rate: 14.8, weight_kg: 69.6, exercise_minutes: 40, source_confidence: 0.84, warnings_json: '[]', import_id: 'import-1' },
]

const latestImport = {
  id: 'import-1',
  user_id: 'user-1',
  device_id_hash: 'test-device',
  source: 'android',
  sync_type: 'health_connect',
  date_range_start: '2026-05-25',
  date_range_end: '2026-05-31',
  started_at: '2026-05-31T08:00:00Z',
  completed_at: '2026-05-31T08:01:00Z',
  status: 'completed',
  record_count: 7,
  app_version: 'browser-test',
}

async function mockSupabase(page) {
  await page.route('https://example.supabase.co/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const wantsSingleImport = path.endsWith('/health_sync_imports') && url.searchParams.get('limit') === '1'

    if (path.endsWith('/daily_health_summary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(summaries),
      })
      return
    }

    if (path.endsWith('/health_sync_imports')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wantsSingleImport ? latestImport : [latestImport]),
      })
      return
    }

    await route.fulfill({ status: 404, body: '[]' })
  })
}

test.beforeEach(async ({ page }) => {
  await mockSupabase(page)
})

test('renders synced dashboard charts on desktop and mobile', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('supabase-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Last 7 days' })).toBeVisible()
  await expect(page.getByText('Latest summary date: 2026-05-31')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyse synced data' })).toBeVisible()

  const charts = page.getByTestId('supabase-chart')
  await expect(charts).toHaveCount(6)
  await expect(page.getByTestId('sparkline-steps')).toBeVisible()
  await expect(page.getByTestId('sparkline-sleep_hours')).toBeVisible()
  await expect(page.getByTestId('sparkline-hrv_rmssd')).toBeVisible()

  const firstChartBox = await charts.first().boundingBox()
  expect(firstChartBox?.width).toBeGreaterThan(250)
  expect(firstChartBox?.height).toBeGreaterThan(150)
})
