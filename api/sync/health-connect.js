import supabaseAdmin from '../lib/supabaseServer.js'

// Simple JSON schema validation (lightweight)
function validatePayload(body) {
  if (!body || typeof body !== 'object') return 'Invalid JSON body'
  if (!body.deviceIdHash) return 'Missing deviceIdHash'
  if (!body.dateRange || !body.dateRange.start || !body.dateRange.end) return 'Missing dateRange.start/end'
  if (!Array.isArray(body.dailySummaries)) return 'dailySummaries must be an array'
  return null
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const auth = req.headers['authorization'] || req.headers['Authorization']
    const secret = process.env.HEALTHLENS_SYNC_SECRET
    if (!secret) return res.status(500).json({ error: 'Server misconfigured: missing HEALTHLENS_SYNC_SECRET' })
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Authorization header' })
    const token = auth.split(' ')[1]
    if (token !== secret) return res.status(403).json({ error: 'Invalid sync token' })

    const body = req.body
    const err = validatePayload(body)
    if (err) return res.status(400).json({ error: err })

    // Prevent huge payloads
    if (body.dailySummaries.length > 1000) return res.status(400).json({ error: 'dailySummaries too large' })

    const user_id = process.env.DEFAULT_USER_ID || 'local-user'

    // Check for an existing import with same device/date-range
    const { data: existing, error: selErr } = await supabaseAdmin
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

    // Create import row
    const importRow = {
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
    }

    const { data: impData, error: impErr } = await supabaseAdmin.from('health_sync_imports').insert(importRow).select().single()
    if (impErr) {
      console.error('Failed to insert import', impErr.message)
      return res.status(500).json({ error: 'Failed to record import' })
    }

    const importId = impData.id

    // Prepare daily summaries for insert
    const summaries = body.dailySummaries.map(s => ({
      user_id,
      date: s.date,
      timezone: s.timezone || body.timezone || 'Australia/Sydney',
      steps: s.steps || null,
      distance_m: s.distance_m || null,
      active_minutes: s.active_minutes || null,
      active_zone_minutes: s.active_zone_minutes || null,
      calories_total: s.calories_total || null,
      resting_hr: s.resting_hr || null,
      hrv_rmssd: s.hrv_rmssd || null,
      respiratory_rate: s.respiratory_rate || null,
      weight_kg: s.weight_kg || null,
      body_fat_percent: s.body_fat_percent || null,
      sleep_minutes: s.sleep_minutes || null,
      sleep_efficiency: s.sleep_efficiency || null,
      exercise_minutes: s.exercise_minutes || null,
      source_confidence: s.source_confidence || 0.8,
      sources_json: JSON.stringify(s.sources || {}),
      warnings_json: JSON.stringify(s.warnings || []),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      import_id: importId
    }))

    // Insert summaries (no dedupe here — rely on import uniqueness)
    const { data: insData, error: insErr } = await supabaseAdmin.from('daily_health_summary').insert(summaries)
    if (insErr) console.error('Failed to insert summaries', insErr.message)

    return res.status(200).json({ ok: true, importId, recordsReceived: summaries.length, warnings: [] })
  } catch (e) {
    console.error('Sync handler error', e.message)
    return res.status(500).json({ error: e.message })
  }
}
