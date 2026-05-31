import { summarizeDailyRows } from './supabaseSummary.js'

function formatMetric(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'missing'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  return String(value)
}

export function buildSyncedDataPack(rows = [], { selectedDays = 7 } = {}) {
  const summary = summarizeDailyRows(rows)
  if (!summary) {
    return {
      name: `supabase-synced-data-${selectedDays}d.md`,
      type: 'supabase',
      size: 0,
      content: 'No synced health data rows were available for analysis.',
      summary: 'No synced health data rows were available for analysis.',
    }
  }

  const firstDate = rows[0]?.date || 'unknown'
  const lastDate = rows[rows.length - 1]?.date || 'unknown'
  const metricRows = [
    ['steps', summary.totals.steps],
    ['sleep_minutes', summary.totals.sleep_minutes],
    ['exercise_minutes', summary.totals.exercise_minutes],
    ['active_minutes', summary.totals.active_minutes],
    ['calories_total', summary.totals.calories_total],
    ['distance_m', summary.totals.distance_m],
    ['avg_hrv_rmssd', summary.averages.hrv_rmssd],
    ['avg_resting_hr', summary.averages.resting_hr],
    ['avg_respiratory_rate', summary.averages.respiratory_rate],
    ['avg_weight_kg', summary.averages.weight_kg],
    ['avg_source_confidence', summary.averages.source_confidence],
  ]

  const dailyLines = rows.map((row) => [
    row.date,
    formatMetric(row.steps),
    formatMetric(row.sleep_minutes),
    formatMetric(row.hrv_rmssd),
    formatMetric(row.resting_hr),
    formatMetric(row.respiratory_rate),
    formatMetric(row.weight_kg),
    formatMetric(row.exercise_minutes),
    formatMetric(row.source_confidence),
  ].join(', '))

  const text = `DATA PACK: SUPABASE SYNCED DAILY HEALTH SUMMARY
Source: Supabase daily_health_summary
Selected window: last ${selectedDays} days
Rows: ${rows.length}
Date range: ${firstDate} to ${lastDate}

SUMMARY METRICS
${metricRows.map(([metric, value]) => `- ${metric}: ${formatMetric(value)}`).join('\n')}

WARNINGS
${summary.warnings.length ? summary.warnings.map((warning) => `- ${warning}`).join('\n') : '- No row-level warnings reported.'}

DAILY ROWS
date, steps, sleep_minutes, hrv_rmssd, resting_hr, respiratory_rate, weight_kg, exercise_minutes, source_confidence
${dailyLines.join('\n')}

INTERPRETATION RULES
- This Data Pack is already cleaned to one daily summary row per synced date.
- Treat missing values as missing, not as zero.
- Treat zero values as real zeros when they appear in the daily rows.
- Do not infer nutrition, blood pressure, glucose, labs, ECG, symptoms, mood, or medications from these rows unless explicitly present elsewhere.
- This is not medical advice.`

  return {
    name: `supabase-synced-data-${selectedDays}d.md`,
    type: 'supabase',
    size: text.length,
    content: text,
    summary: text,
  }
}
