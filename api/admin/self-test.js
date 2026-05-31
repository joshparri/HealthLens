import supabaseAdmin from '../lib/supabaseServer.js'

function getAuthToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization']
  if (!auth || typeof auth !== 'string') return null
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

function buildResponse() {
  return {
    ok: false,
    checks: {
      serviceRoleAvailable: false,
      insertImport: false,
      insertSummary: false,
      queryImport: false,
      querySummary: false,
      idempotency: false,
      cleanup: false,
    },
    createdRows: {
      health_sync_imports: 0,
      daily_health_summary: 0,
    },
    createdIds: {
      importId: null,
    },
    deletedRows: {
      health_sync_imports: 0,
      daily_health_summary: 0,
    },
    warnings: [],
  }
}

export function createAdminSelfTestHandler({ supabaseClient = supabaseAdmin, env = process.env } = {}) {
  return (req, res) => runAdminSelfTest(req, res, { supabaseClient, env })
}

async function runAdminSelfTest(req, res, { supabaseClient, env }) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const adminSecret = env.HEALTHLENS_SYNC_SECRET
  if (!adminSecret) {
    return res.status(500).json({ error: 'Server misconfigured: missing HEALTHLENS_SYNC_SECRET' })
  }

  const token = getAuthToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }
  if (token !== adminSecret) {
    return res.status(403).json({ error: 'Invalid admin token' })
  }

  const result = buildResponse()
  const user_id = env.DEFAULT_USER_ID || 'local-user'
  const importKey = 'self-test-device-001'
  const importDate = '2026-05-30'
  const serviceRoleAvailable = Boolean(
    supabaseClient &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    (env.SUPABASE_URL || env.VITE_SUPABASE_URL)
  )
  result.checks.serviceRoleAvailable = serviceRoleAvailable

  if (!serviceRoleAvailable) {
    result.warnings.push('Server-side Supabase service role is unavailable')
    return res.status(500).json({ ...result, error: 'Supabase service role is unavailable' })
  }

  const body = req.body || {}
  const cleanupImportId = body.cleanupImportId || body.importId
  const cleanupDeviceIdHash = body.deviceIdHash || body.device_id_hash || body.cleanupDeviceIdHash

  try {
    if (cleanupImportId || cleanupDeviceIdHash) {
      const importQuery = supabaseClient.from('health_sync_imports').select('id,user_id,device_id_hash,date_range_start,date_range_end').limit(1)
      if (cleanupImportId) {
        importQuery.eq('id', cleanupImportId)
      }
      if (cleanupDeviceIdHash) {
        importQuery.eq('device_id_hash', cleanupDeviceIdHash)
      }

      const { data: importRows, error: existingImportError } = await importQuery
      if (existingImportError) {
        result.warnings.push('Failed to query existing import: ' + existingImportError.message)
        return res.status(500).json({ ...result, error: 'Failed to query existing import' })
      }

      const importsToDelete = Array.isArray(importRows) ? importRows : []
      if (!importsToDelete.length) {
        return res.status(404).json({ ...result, error: 'No matching import found', warnings: ['No matching fake import found for cleanup'] })
      }

      const allowedTestImport = (row) => {
        const hash = String(row.device_id_hash || '').toLowerCase()
        return row.source === 'self_test' || row.sync_type === 'self_test' || /^test[_-]|^self-test[_-]/i.test(hash)
      }

      const unsafeImport = importsToDelete.find((row) => !allowedTestImport(row))
      if (unsafeImport) {
        return res.status(403).json({
          ...result,
          error: 'Cleanup only allowed for explicit test imports or test device IDs',
          warnings: ['Attempted cleanup of a non-test import was blocked'],
        })
      }

      const importIds = importsToDelete.map(row => row.id)
      result.checks.queryImport = true

      const { data: summaryRows, error: summaryRowsError } = await supabaseClient
        .from('daily_health_summary')
        .select('id,import_id,date,user_id')
        .in('import_id', importIds)

      if (summaryRowsError) {
        result.warnings.push('Failed to query summary rows: ' + summaryRowsError.message)
      } else {
        result.checks.querySummary = true
      }

      const { data: deletedSummary, error: deleteSummaryError } = await supabaseClient
        .from('daily_health_summary')
        .delete()
        .select()
        .in('import_id', importIds)

      if (deleteSummaryError) {
        result.warnings.push('Summary cleanup failed: ' + deleteSummaryError.message)
      } else {
        result.deletedRows.daily_health_summary = Array.isArray(deletedSummary) ? deletedSummary.length : 0
      }

      const { data: deletedImport, error: deleteImportError } = await supabaseClient
        .from('health_sync_imports')
        .delete()
        .select()
        .in('id', importIds)

      if (deleteImportError) {
        result.warnings.push('Import cleanup failed: ' + deleteImportError.message)
      } else {
        result.deletedRows.health_sync_imports = deletedImport?.length || 0
      }

      result.checks.cleanup = result.deletedRows.health_sync_imports > 0
      result.ok = result.checks.serviceRoleAvailable && result.checks.queryImport && result.checks.cleanup
      return res.status(200).json(result)
    }

    const importPayload = {
      user_id,
      source: 'self_test',
      sync_type: 'self_test',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      date_range_start: importDate,
      date_range_end: importDate,
      status: 'completed',
      record_count: 1,
      warnings_json: JSON.stringify([]),
      app_version: 'self-test',
      device_id_hash: importKey,
    }

    const { data: importRow, error: importError } = await supabaseClient
      .from('health_sync_imports')
      .insert(importPayload)
      .select()
      .single()

    if (importError) {
      result.warnings.push('Import insert failed: ' + importError.message)
      return res.status(500).json({ ...result, error: 'Failed to insert import row' })
    }

    result.checks.insertImport = true
    result.createdRows.health_sync_imports = 1
    result.createdIds.importId = importRow.id

    const summaryPayload = {
      user_id,
      date: importDate,
      timezone: 'UTC',
      steps: 1234,
      calories_total: 1500,
      resting_hr: 60,
      hrv_rmssd: 30,
      respiratory_rate: 16,
      weight_kg: 70,
      sleep_minutes: 420,
      exercise_minutes: 10,
      source_confidence: 0.5,
      sources_json: JSON.stringify({ self_test: true }),
      warnings_json: JSON.stringify([]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      import_id: importRow.id,
    }

    const { data: summaryRow, error: summaryError } = await supabaseClient
      .from('daily_health_summary')
      .insert(summaryPayload)
      .select()
      .single()

    if (summaryError) {
      result.warnings.push('Summary insert failed: ' + summaryError.message)
      await supabaseClient.from('health_sync_imports').delete().eq('id', importRow.id)
      return res.status(500).json({ ...result, error: 'Failed to insert summary row' })
    }

    result.checks.insertSummary = true
    result.createdRows.daily_health_summary = 1

    const { data: importQuery, error: importQueryError } = await supabaseClient
      .from('health_sync_imports')
      .select('id, user_id, device_id_hash, date_range_start, date_range_end')
      .eq('id', importRow.id)
      .single()

    if (importQueryError || !importQuery) {
      result.warnings.push('Import query failed')
    } else {
      result.checks.queryImport = true
    }

    const { data: summaryQuery, error: summaryQueryError } = await supabaseClient
      .from('daily_health_summary')
      .select('id, user_id, date, import_id')
      .eq('import_id', importRow.id)

    if (summaryQueryError || !Array.isArray(summaryQuery) || summaryQuery.length !== 1) {
      result.warnings.push('Summary query failed')
    } else {
      result.checks.querySummary = true
    }

    const { error: duplicateError } = await supabaseClient
      .from('health_sync_imports')
      .insert(importPayload)
      .select()
      .single()

    result.checks.idempotency = Boolean(duplicateError && /unique/i.test(duplicateError.message))

    const { data: deletedSummary, error: deleteSummaryError } = await supabaseClient
      .from('daily_health_summary')
      .delete()
      .select()
      .eq('import_id', importRow.id)

    if (deleteSummaryError) {
      result.warnings.push('Summary cleanup failed: ' + deleteSummaryError.message)
    } else {
      result.deletedRows.daily_health_summary = Array.isArray(deletedSummary) ? deletedSummary.length : 0
    }

    const { data: deletedImport, error: deleteImportError } = await supabaseClient
      .from('health_sync_imports')
      .delete()
      .select()
      .eq('id', importRow.id)

    if (deleteImportError) {
      result.warnings.push('Import cleanup failed: ' + deleteImportError.message)
    } else {
      result.deletedRows.health_sync_imports = deletedImport?.length || 0
    }

    result.checks.cleanup = result.deletedRows.health_sync_imports === 1 && result.deletedRows.daily_health_summary === 1
    result.ok = Object.values(result.checks).every(Boolean)

    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ ...result, error: 'Unexpected error', warnings: [...result.warnings, String(error.message || error)] })
  }
}

export default createAdminSelfTestHandler()
