import Dexie from 'dexie'
import { HEALTH_SCHEMA } from './schema.js'

const db = new Dexie('HealthLensDB')

// Map HEALTH_SCHEMA to Dexie stores with basic primary keys
db.version(1).stores({
  health_sources: '++id, name, type, priority',
  health_imports: '++id, source_id, file_name, file_hash, imported_at, date_range_start, date_range_end, status',
  daily_health_summary: 'date, timezone, source_confidence',
  sleep_sessions: '++id, start_time, end_time, source_id, import_id',
  heart_metrics: '++id, timestamp_or_date, metric_type, source_id, import_id',
  body_measurements: '++id, timestamp_or_date, metric_type, source_id, import_id',
  exercise_sessions: '++id, start_time, end_time, activity_type, source_id, import_id',
  lab_results: '++id, collection_date, report_date, test_name, source_file, source_id, import_id',
  daily_context_tags: 'date'
})

export default db

// Convenience helpers
export const addSource = async (source) => {
  const id = await db.health_sources.add(source)
  return id
}

export const addImport = async (imp) => {
  const id = await db.health_imports.add(imp)
  return id
}

export const bulkInsertSummaries = async (rows) => {
  return db.daily_health_summary.bulkAdd(rows)
}

export const bulkInsertSleep = async (rows) => {
  return db.sleep_sessions.bulkAdd(rows)
}

export const bulkInsertHeart = async (rows) => {
  return db.heart_metrics.bulkAdd(rows)
}
