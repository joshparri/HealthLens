import SQL from 'sql.js'
import db, { addSource, addImport, bulkInsertSummaries, bulkInsertSleep, bulkInsertHeart } from './db.js'
import { formatFileSize } from './fileParser.js'

/**
 * Best-effort Health Connect SQLite importer.
 * - accepts a File (SQLite .db or ZIP containing health_connect_export.db)
 * - opens with sql.js and extracts common tables
 * - writes source/import metadata and aggregated daily summaries to IndexedDB
 */
export async function importHealthConnectFile(file, onProgress = () => {}) {
  onProgress(`Starting import of ${file.name}`)

  // Read file into ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()
  onProgress('File loaded into memory')

  // Instantiate SQL.js (uses wasm)
  const SQLLib = (await SQL()).default || SQL
  const sql = await SQLLib({ locateFile: () => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm' })
  onProgress('sql.js initialized')

  const dbSql = new sql.Database(new Uint8Array(arrayBuffer))
  onProgress('SQLite DB opened')

  // Find tables
  const tablesRes = dbSql.exec("SELECT name FROM sqlite_master WHERE type='table'")
  const tables = tablesRes.length ? tablesRes[0].values.map(r => r[0]) : []
  onProgress(`Found ${tables.length} tables`) 

  // Create source and import records
  const sourceId = await addSource({ name: 'Health Connect', type: 'health_connect', priority: 1, notes: '' })
  const importId = await addImport({ source_id: sourceId, file_name: file.name, file_hash: '', imported_at: new Date().toISOString(), status: 'completed', record_count: 0 })

  // Heuristics: look for step, heart, sleep related tables
  const stepTables = tables.filter(t => /step|steps/i.test(t))
  const hrTables = tables.filter(t => /heart|hr|pulse/i.test(t))
  const sleepTables = tables.filter(t => /sleep/i.test(t))

  // Aggregate steps per day (best-effort)
  const dailySummaries = []
  if (stepTables.length) {
    for (const t of stepTables) {
      try {
        const qr = dbSql.exec(`SELECT * FROM "${t}" LIMIT 1000`)
        if (!qr.length) continue
        const cols = qr[0].columns
        const rows = qr[0].values
        // Try to find a date column
        const dateCol = cols.find(c => /date|start_time|timestamp|day/i.test(c))
        const countCol = cols.find(c => /count|steps|value|delta/i.test(c))
        if (!dateCol) continue
        const di = cols.indexOf(dateCol)
        const ci = countCol ? cols.indexOf(countCol) : -1
        const byDay = {}
        rows.forEach(r => {
          const raw = r[di]
          let d = null
          if (typeof raw === 'number' && String(raw).length > 10) {
            // maybe ms since epoch
            d = new Date(Number(raw)).toISOString().slice(0,10)
          } else if (typeof raw === 'number') {
            d = new Date(Number(raw) * 1000).toISOString().slice(0,10)
          } else {
            d = new Date(String(raw)).toISOString().slice(0,10)
          }
          const val = ci >= 0 ? Number(r[ci]) || 0 : 1
          byDay[d] = (byDay[d] || 0) + val
        })
        Object.entries(byDay).forEach(([date, steps]) => {
          dailySummaries.push({ date, timezone: 'Australia/Sydney', steps, source_confidence: 0.8, sources_json: JSON.stringify({ table: t }), imported_at: new Date().toISOString() })
        })
      } catch (e) {
        console.warn('Step table parse failed', t, e.message)
      }
    }
  }

  // Heart rate samples — store as heart_metrics (average per day)
  const heartMetrics = []
  if (hrTables.length) {
    for (const t of hrTables) {
      try {
        const qr = dbSql.exec(`SELECT * FROM "${t}" LIMIT 2000`)
        if (!qr.length) continue
        const cols = qr[0].columns
        const rows = qr[0].values
        const tsCol = cols.find(c => /time|timestamp|start/i.test(c))
        const valCol = cols.find(c => /value|bpm|heart_rate|hr/i.test(c))
        if (!tsCol || !valCol) continue
        const ti = cols.indexOf(tsCol)
        const vi = cols.indexOf(valCol)
        const byDay = {}
        rows.forEach(r => {
          const ts = r[ti]
          let d = null
          if (typeof ts === 'number' && String(ts).length > 10) d = new Date(Number(ts)).toISOString().slice(0,10)
          else if (typeof ts === 'number') d = new Date(Number(ts)*1000).toISOString().slice(0,10)
          else d = new Date(String(ts)).toISOString().slice(0,10)
          const v = Number(r[vi]) || null
          if (!v) return
          byDay[d] = byDay[d] || { sum:0, count:0 }
          byDay[d].sum += v; byDay[d].count += 1
        })
        Object.entries(byDay).forEach(([date, obj]) => {
          const avg = Math.round(obj.sum / obj.count)
          heartMetrics.push({ timestamp_or_date: date, metric_type: 'resting_hr', value: avg, unit: 'bpm', source_id: sourceId, import_id: importId, raw_json: JSON.stringify({ table: t }) })
        })
      } catch (e) {
        console.warn('HR table parse failed', t, e.message)
      }
    }
  }

  // Sleep sessions — best-effort copy first rows into sleep_sessions
  const sleepRows = []
  if (sleepTables.length) {
    for (const t of sleepTables) {
      try {
        const qr = dbSql.exec(`SELECT * FROM "${t}" LIMIT 200`)
        if (!qr.length) continue
        const cols = qr[0].columns
        const rows = qr[0].values
        const startCol = cols.find(c => /start/i.test(c))
        const endCol = cols.find(c => /end/i.test(c))
        const asleepCol = cols.find(c => /asleep|duration|minutes|seconds/i.test(c))
        rows.forEach(r => {
          const start = startCol ? r[cols.indexOf(startCol)] : null
          const end = endCol ? r[cols.indexOf(endCol)] : null
          const asleep = asleepCol ? Number(r[cols.indexOf(asleepCol)]) : null
          const parseTime = (v) => {
            if (!v) return null
            if (typeof v === 'number' && String(v).length > 10) return new Date(Number(v)).toISOString()
            if (typeof v === 'number') return new Date(Number(v)*1000).toISOString()
            return new Date(String(v)).toISOString()
          }
          sleepRows.push({ start_time: parseTime(start), end_time: parseTime(end), duration_minutes: asleep, source_id: sourceId, import_id: importId, raw_json: JSON.stringify({ table: t }) })
        })
      } catch (e) {
        console.warn('Sleep table parse failed', t, e.message)
      }
    }
  }

  // Persist to IndexedDB
  if (dailySummaries.length) {
    await bulkInsertSummaries(dailySummaries)
  }
  if (heartMetrics.length) {
    await bulkInsertHeart(heartMetrics)
  }
  if (sleepRows.length) {
    await bulkInsertSleep(sleepRows)
  }

  onProgress(`Import complete — ${dailySummaries.length} day summaries, ${heartMetrics.length} heart metrics, ${sleepRows.length} sleep rows stored. (${formatFileSize(file.size)})`)
  return { sourceId, importId, dailySummariesCount: dailySummaries.length, heartMetricsCount: heartMetrics.length, sleepRowsCount: sleepRows.length }
}
