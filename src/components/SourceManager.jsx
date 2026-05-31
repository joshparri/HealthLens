import { SOURCE_PRIORITY } from '../lib/schema.js'
import { useEffect, useState } from 'react'
import db from '../lib/db.js'

export default function SourceManager({ parsedFiles }) {
  const [sourcesState, setSourcesState] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const sources = await db.health_sources.toArray()
        const imports = await db.health_imports.orderBy('imported_at').reverse().toArray()
        // Map known sources list to include DB state
        const known = [
          { id: 'health_connect', name: 'Health Connect', icon: '📱' },
          { id: 'withings', name: 'Withings', icon: '⚖️' },
          { id: 'fitbit', name: 'Fitbit', icon: '⌚' },
          { id: 'sleep_as_android', name: 'Sleep as Android', icon: '😴' },
          { id: 'strava', name: 'Strava', icon: '🏃' },
          { id: 'welltory', name: 'Welltory', icon: '💓' },
        ]
        const merged = known.map(k => {
          const found = sources.find(s => s.type === k.id || (s.name || '').toLowerCase().includes(k.id.replace('_',' ')))
          const lastImport = imports.find(i => i.source_id === (found?.id))
          return { ...k, connected: !!found, lastImport: lastImport?.imported_at || null }
        })
        if (mounted) setSourcesState(merged)
      } catch (e) {
        console.warn('Failed to load sources from DB', e.message)
      }
    })()
    return () => { mounted = false }
  }, [parsedFiles])

  return (
    <div className="bg-ink-soft border border-slate-border rounded-2xl p-6 space-y-6 animate-slide-up">
      <div className="space-y-1">
        <h3 className="font-display font-semibold text-white text-base">Health Sources</h3>
        <p className="text-slate-ui text-xs">Manage your data sources and priorities</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sourcesState.map(s => (
          <div key={s.id} className="bg-ink border border-slate-border rounded-xl p-4 flex items-center gap-4">
            <span className="text-2xl">{s.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{s.name}</p>
              <p className={`text-[10px] font-mono uppercase ${s.connected ? 'text-jade' : 'text-slate-ui/40'}`}>
                {s.connected ? `● Connected • Last import ${s.lastImport ? new Date(s.lastImport).toLocaleString() : '—'}` : '○ Not found'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-border/50">
        <h4 className="text-xs text-slate-ui font-medium uppercase tracking-wider mb-3">Priority Rules</h4>
        <div className="space-y-2">
          {Object.entries(SOURCE_PRIORITY).map(([metric, priority]) => (
            <div key={metric} className="flex items-center justify-between text-xs">
              <span className="text-white capitalize">{metric}</span>
              <div className="flex gap-1.5">
                {priority.map((p, i) => (
                  <span key={p} className={`px-2 py-0.5 rounded-full border ${i === 0 ? 'bg-jade/10 border-jade/30 text-jade' : 'border-slate-border text-slate-ui'}`}>
                    {p.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
