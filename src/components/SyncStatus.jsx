function formatDateTime(dateString) {
  if (!dateString) return '--'
  try {
    return new Date(dateString).toLocaleString()
  } catch {
    return dateString
  }
}

export default function SyncStatus({ latestImport, recentImports, loading }) {
  return (
    <section className="rounded-3xl border border-slate-border bg-ink-soft p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Sync status</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Import history and activity</h3>
        </div>
        <span className="rounded-full bg-slate-ui/10 px-3 py-1 text-xs font-mono text-slate-ui">Latest data only</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Latest import</p>
          <p className="mt-3 text-lg font-semibold text-white">{latestImport?.id ?? 'No imports found'}</p>
          <p className="mt-2 text-sm text-slate-ui">{latestImport ? `${latestImport.status || 'unknown'} · ${latestImport.record_count ?? '--'} rows` : 'Awaiting data'}</p>
          {latestImport?.device_id_hash && (
            <p className="mt-1 text-sm text-slate-ui">Device: {latestImport.device_id_hash}</p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Date range</p>
          <p className="mt-3 text-lg font-semibold text-white">{latestImport?.date_range_start ?? '--'} → {latestImport?.date_range_end ?? '--'}</p>
          <p className="mt-2 text-sm text-slate-ui">Completed at {formatDateTime(latestImport?.completed_at)}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Recent imports</p>
        {loading ? (
          <div className="rounded-3xl border border-slate-border bg-ink p-4 text-sm text-slate-ui">Loading import history…</div>
        ) : (!recentImports || recentImports.length === 0) ? (
          <div className="rounded-3xl border border-slate-border bg-ink p-4 text-sm text-slate-ui">No import history yet.</div>
        ) : (
          <div className="grid gap-3">
            {recentImports.slice(0, 4).map((row) => (
              <div key={row.id} className="rounded-3xl border border-slate-border bg-ink p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white truncate">{row.source} / {row.sync_type}</p>
                  <span className="text-[11px] uppercase tracking-[0.35em] text-slate-ui">{row.status || 'unknown'}</span>
                </div>
                <p className="mt-2 text-sm text-slate-ui">{row.date_range_start} → {row.date_range_end}</p>
                <p className="mt-1 text-sm text-slate-ui">{formatDateTime(row.completed_at)} · {row.record_count ?? '--'} rows</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
