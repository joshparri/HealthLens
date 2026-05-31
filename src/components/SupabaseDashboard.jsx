import { useMemo } from 'react'
import { summarizeDailyRows } from '../lib/supabaseSummary.js'

function formatValue(value, fallback = '--', digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  if (typeof value === 'number') {
    return digits > 0 ? value.toFixed(digits) : Math.round(value).toLocaleString()
  }
  return String(value)
}

function MiniLineChart({ rows, dataKey, stroke }) {
  const width = 320
  const height = 132
  const pad = 18
  const points = rows
    .map((row, index) => ({ index, value: row[dataKey] }))
    .filter((point) => typeof point.value === 'number')

  if (points.length < 2) {
    return <div className="flex h-44 items-center justify-center text-sm text-slate-ui">Not enough points yet.</div>
  }

  const min = Math.min(...points.map((point) => point.value))
  const max = Math.max(...points.map((point) => point.value))
  const spread = max - min || 1
  const maxIndex = Math.max(1, rows.length - 1)
  const path = points.map((point, index) => {
    const x = pad + (point.index / maxIndex) * (width - pad * 2)
    const y = height - pad - ((point.value - min) / spread) * (height - pad * 2)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

  return (
    <div className="mt-4 h-44">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1={pad}
            x2={width - pad}
            y1={pad + line * (height - pad * 2)}
            y2={pad + line * (height - pad * 2)}
            stroke="rgba(148, 163, 184, 0.13)"
            strokeWidth="1"
          />
        ))}
        <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x={pad} y={height - 2} fill="#94a3b8" fontSize="10">{rows[0]?.label || ''}</text>
        <text x={width - pad} y={height - 2} fill="#94a3b8" fontSize="10" textAnchor="end">{rows[rows.length - 1]?.label || ''}</text>
        <text x={pad} y={12} fill="#94a3b8" fontSize="10">{formatValue(max, '--', 1)}</text>
        <text x={width - pad} y={12} fill="#94a3b8" fontSize="10" textAnchor="end">{formatValue(min, '--', 1)}</text>
      </svg>
    </div>
  )
}

export default function SupabaseDashboard({ summaries, selectedDays, onSelectDays }) {
  const summary = useMemo(() => summarizeDailyRows(summaries || []), [summaries])

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
    { label: 'Steps', value: formatValue(summary.totals.steps ?? summary.latest.steps, '--'), note: 'Total steps' },
    { label: 'Sleep minutes', value: formatValue(summary.totals.sleep_minutes ?? summary.latest.sleep_minutes, '--'), note: 'Total sleep' },
    { label: 'HRV / RMSSD', value: formatValue(summary.averages.hrv_rmssd, '--', 1), note: 'Average over range' },
    { label: 'Resting HR', value: formatValue(summary.averages.resting_hr, '--', 1), note: 'Average rest HR' },
    { label: 'Respiratory rate', value: formatValue(summary.averages.respiratory_rate, '--', 1), note: 'Average respiration' },
    { label: 'Weight', value: formatValue(summary.averages.weight_kg, '--', 1), note: 'Average kg' },
    { label: 'Exercise minutes', value: formatValue(summary.totals.exercise_minutes ?? summary.latest.exercise_minutes, '--'), note: 'Total exercise' },
    { label: 'Source confidence', value: formatValue(summary.averages.source_confidence, '--', 2), note: 'Average confidence' },
  ]

  const charts = [
    { key: 'steps', label: 'Steps', stroke: '#34d399' },
    { key: 'sleep_hours', label: 'Sleep hours', stroke: '#60a5fa' },
    { key: 'hrv_rmssd', label: 'HRV / RMSSD', stroke: '#fbbf24' },
    { key: 'resting_hr', label: 'Resting HR', stroke: '#fb7185' },
    { key: 'weight_kg', label: 'Weight kg', stroke: '#a78bfa' },
    { key: 'exercise_minutes', label: 'Exercise minutes', stroke: '#2dd4bf' },
  ].filter((chart) => summary.chartRows.some((row) => typeof row[chart.key] === 'number'))

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

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {charts.length > 0 ? charts.map((chart) => (
          <div key={chart.key} className="rounded-3xl border border-slate-border bg-ink p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">{chart.label}</p>
            <MiniLineChart rows={summary.chartRows} dataKey={chart.key} stroke={chart.stroke} />
          </div>
        )) : (
          <div className="rounded-3xl border border-slate-border bg-ink p-5 text-sm text-slate-ui">
            No chartable synced metrics found for this range.
          </div>
        )}
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
