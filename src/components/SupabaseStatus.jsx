export default function SupabaseStatus({ configured, loading, error, latestImport, summariesCount, onRefresh }) {
  const connected = configured && !error
  return (
    <section className="rounded-3xl border border-slate-border bg-ink-soft p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Supabase Live Sync</p>
          <h2 className="mt-2 text-2xl font-display font-bold text-white">Live health data dashboard</h2>
          <p className="mt-2 text-sm leading-6 text-slate-ui max-w-2xl">
            This panel reads from Supabase and shows the latest synced health rows from `daily_health_summary` and `health_sync_imports`.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <span className={`rounded-full px-3 py-1 text-xs font-mono border ${connected ? 'bg-jade/10 text-jade border-jade/20' : 'bg-slate-ui/10 text-slate-ui border-slate-border'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-full border border-jade/20 bg-jade/10 px-4 py-2 text-sm font-medium text-jade transition hover:bg-jade/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Summaries</p>
          <p className="mt-3 text-3xl font-bold text-white">{summariesCount ?? '--'}</p>
          <p className="mt-1 text-sm text-slate-ui">daily summary rows in current range</p>
        </div>
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Latest sync</p>
          <p className="mt-3 text-xl font-semibold text-white">
            {latestImport?.completed_at ? new Date(latestImport.completed_at).toLocaleString() : 'No sync yet'}
          </p>
          <p className="mt-1 text-sm text-slate-ui">Most recent import completion time</p>
        </div>
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Source</p>
          <p className="mt-3 text-xl font-semibold text-white">{latestImport?.source ?? '--'}</p>
          <p className="mt-1 text-sm text-slate-ui">Latest import source type</p>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-3xl border border-crimson-health/20 bg-crimson-glow p-4 text-sm text-crimson-health">
          <strong>Supabase error:</strong> {error}
        </div>
      )}
    </section>
  )
}
