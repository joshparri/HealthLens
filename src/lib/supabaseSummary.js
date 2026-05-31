export function parseWarnings(rows = []) {
  const warnings = new Set()
  rows.forEach((row) => {
    if (!row) return
    const raw = row.warnings_json
    if (!raw) return
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed)) parsed.forEach((warning) => warning && warnings.add(String(warning)))
    } catch {
      warnings.add(String(raw))
    }
  })
  return [...warnings]
}

export function average(rows = [], key) {
  const values = rows.map((row) => row?.[key]).filter((value) => typeof value === 'number')
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function total(rows = [], key) {
  const values = rows.map((row) => row?.[key]).filter((value) => typeof value === 'number')
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0)
}

export function summarizeDailyRows(rows = []) {
  if (!rows.length) return null

  const latest = rows[rows.length - 1]
  return {
    latest,
    totals: {
      steps: total(rows, 'steps'),
      sleep_minutes: total(rows, 'sleep_minutes'),
      exercise_minutes: total(rows, 'exercise_minutes'),
      active_minutes: total(rows, 'active_minutes'),
      calories_total: total(rows, 'calories_total'),
      distance_m: total(rows, 'distance_m'),
    },
    averages: {
      hrv_rmssd: average(rows, 'hrv_rmssd'),
      resting_hr: average(rows, 'resting_hr'),
      respiratory_rate: average(rows, 'respiratory_rate'),
      weight_kg: average(rows, 'weight_kg'),
      source_confidence: average(rows, 'source_confidence'),
    },
    warnings: parseWarnings(rows),
    chartRows: rows.map((row) => ({
      date: row.date,
      label: row.date ? row.date.slice(5) : '',
      steps: typeof row.steps === 'number' ? row.steps : null,
      sleep_hours: typeof row.sleep_minutes === 'number' ? Number((row.sleep_minutes / 60).toFixed(2)) : null,
      hrv_rmssd: typeof row.hrv_rmssd === 'number' ? row.hrv_rmssd : null,
      resting_hr: typeof row.resting_hr === 'number' ? row.resting_hr : null,
      respiratory_rate: typeof row.respiratory_rate === 'number' ? row.respiratory_rate : null,
      weight_kg: typeof row.weight_kg === 'number' ? row.weight_kg : null,
      exercise_minutes: typeof row.exercise_minutes === 'number' ? row.exercise_minutes : null,
    })),
  }
}
