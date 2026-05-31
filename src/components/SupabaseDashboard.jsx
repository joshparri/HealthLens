import { useMemo } from 'react'

function parseWarnings(rows) {
  const warnings = new Set()
  rows.forEach((row) => {
    if (!row) return
    try {
      const parsed = row.warnings_json ? JSON.parse(row.warnings_json) : []
      if (Array.isArray(parsed)) parsed.forEach((warning) => warning && warnings.add(warning))
    } catch (_) {}
  })
  return [...warnings]
}

function formatValue(value, fallback = '--', digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  if (typeof value === 'number') {
    return digits > 0 ? value.toFixed(digits) : Math.round(value).toLocaleString()
  }
  return String(value)
}

export default function SupabaseDashboard({ summaries, selectedDays, onSelectDays }) {
  const summary = useMemo(() => {
    if (!summaries || summaries.length === 0) return null

    const latest = summaries[summaries.length - 1]
    const totals = summaries.reduce(
      (acc, row) => {
        if (typeof row.steps === 'number') acc.steps += row.steps
        if (typeof row.sleep_minutes === 'number') acc.sleep_minutes += row.sleep_minutes
        if (typeof row.exercise_minutes === 'number') acc.exercise_minutes += row.exercise_minutes
        if (typeof row.calories_total === 'number') acc.calories_total += row.calories_total
        if (typeof row.distance_m === 'number') acc.distance_m += row.distance_m
        if (typeof row.active_minutes === 'number') acc.active_minutes += row.active_minutes
        if (typeof row.hrv_rmssd === 'number') acc.hrv_rmssd += row.hrv_rmssd
        if (typeof row.resting_hr === 'number') acc.resting_hr += row.resting_hr
        if (typeof row.respiratory_rate === 'number') acc.respiratory_rate += row.respiratory_rate
        if (typeof row.weight_kg === 'number') acc.weight_kg += row.weight_kg
        if (typeof row.source_confidence === 'number') acc.source_confidence += row.source_confidence
        return acc
      },
      {
        steps: 0,
        sleep_minutes: 0,
        exercise_minutes: 0,
        active_minutes: 0,
        calories_total: 0,
        distance_m: 0,
        hrv_rmssd: 0,
        resting_hr: 0,
        respiratory_rate: 0,
        weight_kg: 0,
        source_confidence: 0,
      }
    )

    return {
      latest,
      totals,
      averages: {
        hrv_rmssd: summaries.filter((r) => typeof r.hrv_rmssd === 'number').reduce((sum, r) => sum + r.hrv_rmssd, 0) / Math.max(1, summaries.filter((r) => typeof r.hrv_rmssd === 'number').length),
        resting_hr: summaries.filter((r) => typeof r.resting_hr === 'number').reduce((sum, r) => sum + r.resting_hr, 0) / Math.max(1, summaries.filter((r) => typeof r.resting_hr === 'number').length),
        respiratory_rate: summaries.filter((r) => typeof r.respiratory_rate === 'number').reduce((sum, r) => sum + r.respiratory_rate, 0) / Math.max(1, summaries.filter((r) => typeof r.respiratory_rate === 'number').length),
        weight_kg: summaries.filter((r) => typeof r.weight_kg === 'number').reduce((sum, r) => sum + r.weight_kg, 0) / Math.max(1, summaries.filter((r) => typeof r.weight_kg === 'number').length),
        source_confidence: summaries.filter((r) => typeof r.source_confidence === 'number').reduce((sum, r) => sum + r.source_confidence, 0) / Math.max(1, summaries.filter((r) => typeof r.source_confidence === 'number').length),
      },
      warnings: parseWarnings(summaries),
    }
  }, [summaries])

  if (!summary) {
    return (
      <section className="rounded-3xl border border-slate-border bg-ink-soft p-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Dashboard</p>
          <h3 className="text-2xl font-semibold text-white">No synced health data yet</h3>
          <p className="text-sm leading-6 text-slate-ui">
            No synced health data yet. Use Android HealthLens Sync or manual upload.
          </p>
        </div>
      </section>
    )
  }

  const cards = [
    { label: 'Steps', value: formatValue(summary.totals.steps || summary.latest.steps, '--'), note: 'Total steps' },
    { label: 'Sleep minutes', value: formatValue(summary.totals.sleep_minutes || summary.latest.sleep_minutes, '--'), note: 'Total sleep' },
    { label: 'HRV / RMSSD', value: formatValue(summary.averages.hrv_rmssd, '--', 1), note: 'Average over range' },
    { label: 'Resting HR', value: formatValue(summary.averages.resting_hr, '--', 1), note: 'Average rest HR' },
    { label: 'Respiratory rate', value: formatValue(summary.averages.respiratory_rate, '--', 1), note: 'Average respiration' },
    { label: 'Weight', value: formatValue(summary.averages.weight_kg, '--', 1), note: 'Average kg' },
    { label: 'Exercise minutes', value: formatValue(summary.totals.exercise_minutes || summary.latest.exercise_minutes, '--'), note: 'Total exercise' },
    { label: 'Source confidence', value: formatValue(summary.averages.source_confidence, '--', 2), note: 'Average confidence' },
  ]

  return (
    <section className="rounded-3xl border border-slate-border bg-ink-soft p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Supabase Dashboard</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Last {selectedDays} days</h3>
          <p className="mt-2 text-sm text-slate-ui">Latest summary date: {summary.latest.date}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onSelectDays(days)}
              className={`rounded-full border px-4 py-2 font-mono ${selectedDays === days ? 'border-jade bg-jade/10 text-jade' : 'border-slate-border bg-ink text-slate-ui hover:border-white/10 hover:text-white'}`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-border bg-ink p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">{card.label}</p>
            <p className="mt-3 text-3xl font-bold text-white">{card.value}</p>
            <p className="mt-2 text-sm text-slate-ui">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-slate-border bg-ink p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Warnings</p>
          <span className="text-xs text-slate-ui">{summary.warnings.length} unique issues</span>
        </div>
        {summary.warnings.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-slate-ui list-disc list-inside">
            {summary.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-ui">No warnings were reported for the selected summaries.</p>
        )}
      </div>
    </section>
  )
}
