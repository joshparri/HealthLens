import supabaseAdmin from '../lib/supabaseServer.js'

function validatePayload(body) {
  if (!body || typeof body !== 'object') return 'Invalid JSON body'
  if (!body.deviceIdHash) return 'Missing deviceIdHash'
  if (!body.dateRange || !body.dateRange.start || !body.dateRange.end) return 'Missing dateRange.start/end'
  if (!Array.isArray(body.dailySummaries)) return 'dailySummaries must be an array'
  return null
}

function valueOrNull(value) {
  return value === undefined ? null : value
}

function jsonValue(value, fallback) {
  return JSON.stringify(value ?? fallback)
}

function buildSummaryRow(summary, body, importId, userId) {
  return {
    user_id: userId,
    date: summary.date,
    timezone: summary.timezone || body.timezone || 'Australia/Sydney',
    steps: valueOrNull(summary.steps),
    distance_m: valueOrNull(summary.distance_m),
    active_minutes: valueOrNull(summary.active_minutes),
    active_zone_minutes: valueOrNull(summary.active_zone_minutes),
    calories_total: valueOrNull(summary.calories_total),
    resting_hr: valueOrNull(summary.resting_hr),
    hrv_rmssd: valueOrNull(summary.hrv_rmssd),
    respiratory_rate: valueOrNull(summary.respiratory_rate),
    weight_kg: valueOrNull(summary.weight_kg),
    body_fat_percent: valueOrNull(summary.body_fat_percent),
    sleep_minutes: valueOrNull(summary.sleep_minutes),
    sleep_efficiency: valueOrNull(summary.sleep_efficiency),
    exercise_minutes: valueOrNull(summary.exercise_minutes),
    source_confidence: summary.source_confidence ?? 0.8,
    sources_json: jsonValue(summary.sources, {}),
    warnings_json: jsonValue(summary.warnings, []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    import_id: importId
  }
}

export function createSyncHandler({ supabaseClient = supabaseAdmin, env = process.env } = {}) {
  return async function handler(req, res) {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

      const auth = req.headers['authorization'] || req.headers['Authorization']
      const secret = env.HEALTHLENS_SYNC_SECRET
      if (!secret) return res.status(500).json({ error: 'Server misconfigured: missing HEALTHLENS_SYNC_SECRET' })
      if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Authorization header' })

      const token = auth.split(' ')[1]
      if (token !== secret) return res.status(403).json({ error: 'Invalid sync token' })

      const body = req.body
      const err = validatePayload(body)
      if (err) return res.status(400).json({ error: err })

      if (!supabaseClient) {
        return res.status(500).json({ error: 'Server misconfigured: missing Supabase service role or URL' })
      }

      if (body.dailySummaries.length > 1000) return res.status(400).json({ error: 'dailySummaries too large' })

      const user_id = env.DEFAULT_USER_ID || 'local-user'

      // Check for existing import
      const { data: existing, error: selErr } = await supabaseClient
        .from('health_sync_imports')
        .select('*')
        .eq('user_id', user_id)
        .eq('device_id_hash', body.deviceIdHash)
        .eq('date_range_start', body.dateRange.start)
        .eq('date_range_end', body.dateRange.end)
        .limit(1)

      if (selErr) console.warn('Supabase select error', selErr.message)
      if (existing && existing.length) {
        return res.status(200).json({ ok: true, importId: existing[0].id, recordsReceived: 0, warnings: ['Import already exists'] })
      }

      // Record import
      const { data: impData, error: impErr } = await supabaseClient
        .from('health_sync_imports')
        .insert({
          user_id,
          source: 'health_connect',
          sync_type: 'android_health_connect',
          started_at: body.syncStartedAt || new Date().toISOString(),
          completed_at: new Date().toISOString(),
          date_range_start: body.dateRange.start,
          date_range_end: body.dateRange.end,
          status: 'completed',
          record_count: body.dailySummaries.length,
          warnings_json: JSON.stringify(body.warnings || []),
          app_version: body.appVersion || null,
          device_id_hash: body.deviceIdHash || null
        })
        .select()
        .single()

      if (impErr) {
        console.error('Failed to insert import', impErr.message)
        return res.status(500).json({ error: 'Failed to record import' })
      }

      const importId = impData.id

      // Detailed records (sleep, heart, weight, exercise)
      const sleepRecords = (body.sleepRecords || []).map(r => ({
        user_id,
        import_id: importId,
        start_time: r.start_time,
        end_time: r.end_time,
        duration_minutes: r.duration_minutes,
        timezone: r.timezone || body.timezone || 'Australia/Sydney',
        efficiency: r.efficiency || null,
        stages_json: JSON.stringify(r.stages || {}),
        source_id: r.source_id || 'health_connect'
      }))

      const heartRecords = (body.heartRecords || []).map(r => ({
        user_id,
        import_id: importId,
        timestamp: r.timestamp,
        metric_type: r.metric_type,
        value: r.value,
        source_id: r.source_id || 'health_connect'
      }))

      const bodyRecords = (body.bodyRecords || []).map(r => ({
        user_id,
        import_id: importId,
        timestamp: r.timestamp,
        metric_type: r.metric_type,
        value: r.value,
        source_id: r.source_id || 'health_connect'
      }))

      const exerciseRecords = (body.exerciseRecords || []).map(r => ({
        user_id,
        import_id: importId,
        start_time: r.start_time,
        end_time: r.end_time,
        activity_type: r.activity_type,
        calories_burned: r.calories_burned || null,
        distance_m: r.distance_m || null,
        source_id: r.source_id || 'health_connect'
      }))

      if (sleepRecords.length) await supabaseClient.from('sleep_sessions').insert(sleepRecords)
      if (heartRecords.length) await supabaseClient.from('heart_metrics').insert(heartRecords)
      if (bodyRecords.length) await supabaseClient.from('body_measurements').insert(bodyRecords)
      if (exerciseRecords.length) await supabaseClient.from('exercise_sessions').insert(exerciseRecords)

      // Daily summaries
      const summaries = body.dailySummaries.map(s => buildSummaryRow(s, body, importId, user_id))
      const { error: insErr } = await supabaseClient.from('daily_health_summary').insert(summaries)
      if (insErr) console.error('Failed to insert summaries', insErr.message)

      return res.status(200).json({ ok: true, importId, recordsReceived: summaries.length, warnings: [] })
    } catch (e) {
      console.error('Sync handler error', e.message)
      return res.status(500).json({ error: e.message })
    }
  }
}

export default createSyncHandler()
