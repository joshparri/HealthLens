import { supabase } from './supabaseClient.js'

const summaryFields = `
  id,
  user_id,
  date,
  timezone,
  steps,
  sleep_minutes,
  hrv_rmssd,
  resting_hr,
  respiratory_rate,
  weight_kg,
  exercise_minutes,
  source_confidence,
  warnings_json,
  distance_m,
  active_minutes,
  calories_total,
  import_id,
  created_at,
  updated_at
`

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)
)

function defaultDateString(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function normalizeResult({ data, error }) {
  return { data: data ?? null, error: error ?? null }
}

export async function getDailySummaries({ days = 7, startDate, endDate } = {}) {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error('Supabase is not configured for browser access') }
  }

  const today = defaultDateString()
  const end = endDate || today
  const start = startDate || defaultDateString(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000))

  const response = await supabase
    .from('daily_health_summary')
    .select(summaryFields)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .limit(200)

  return normalizeResult(response)
}

export async function getLatestSyncStatus() {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase is not configured for browser access') }
  }

  const response = await supabase
    .from('health_sync_imports')
    .select('id,user_id,device_id_hash,source,sync_type,date_range_start,date_range_end,started_at,completed_at,status,record_count,app_version')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  return normalizeResult(response)
}

export async function getSyncImports({ limit = 8 } = {}) {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error('Supabase is not configured for browser access') }
  }

  const response = await supabase
    .from('health_sync_imports')
    .select('id,device_id_hash,source,sync_type,date_range_start,date_range_end,started_at,completed_at,status,record_count,app_version')
    .order('completed_at', { ascending: false })
    .limit(limit)

  return normalizeResult(response)
}

export async function getMetricAvailability({ days = 30, startDate, endDate } = {}) {
  const result = await getDailySummaries({ days, startDate, endDate })
  if (result.error) return { data: null, error: result.error }

  const summaries = result.data || []
  const metrics = {
    rows: summaries.length,
    steps: 0,
    sleep_minutes: 0,
    hrv_rmssd: 0,
    resting_hr: 0,
    respiratory_rate: 0,
    weight_kg: 0,
    exercise_minutes: 0,
    source_confidence: 0,
    warnings: 0,
    dateRange: summaries.length > 0 ? [summaries[0].date, summaries[summaries.length - 1].date] : null,
  }

  summaries.forEach((row) => {
    if (typeof row.steps === 'number') metrics.steps += row.steps
    if (typeof row.sleep_minutes === 'number') metrics.sleep_minutes += row.sleep_minutes
    if (typeof row.hrv_rmssd === 'number') metrics.hrv_rmssd += row.hrv_rmssd
    if (typeof row.resting_hr === 'number') metrics.resting_hr += row.resting_hr
    if (typeof row.respiratory_rate === 'number') metrics.respiratory_rate += row.respiratory_rate
    if (typeof row.weight_kg === 'number') metrics.weight_kg += row.weight_kg
    if (typeof row.exercise_minutes === 'number') metrics.exercise_minutes += row.exercise_minutes
    if (typeof row.source_confidence === 'number') metrics.source_confidence += row.source_confidence
    if (row.warnings_json) {
      try { const warnings = JSON.parse(row.warnings_json); if (Array.isArray(warnings)) metrics.warnings += warnings.length } catch (_) {}
    }
  })

  if (metrics.rows > 0) {
    metrics.hrv_rmssd = Number((metrics.hrv_rmssd / metrics.rows).toFixed(1))
    metrics.resting_hr = Number((metrics.resting_hr / metrics.rows).toFixed(1))
    metrics.respiratory_rate = Number((metrics.respiratory_rate / metrics.rows).toFixed(1))
    metrics.weight_kg = Number((metrics.weight_kg / metrics.rows).toFixed(1))
    metrics.source_confidence = Number((metrics.source_confidence / metrics.rows).toFixed(2))
  }

  return { data: metrics, error: null }
}
