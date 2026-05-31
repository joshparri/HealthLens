import { useMemo } from 'react'

export default function Dashboard({ parsedFiles = [] }) {
  const stats = useMemo(() => {
    const report = parsedFiles.find(f => f.content?.includes('DATA PACK: STRUCTURED HEALTH INVENTORY'))
    if (!report) return null

    const lines = report.content.split('\n')
    const metrics = {}
    let currentMetric = null

    lines.forEach(line => {
      if (line.startsWith('=== METRIC:')) {
        currentMetric = line.replace('=== METRIC: ', '').replace(' ===', '').toLowerCase()
        metrics[currentMetric] = { count: 0, range: null, status: 'empty' }
      } else if (currentMetric && line.startsWith('- Table:')) {
        const rows = parseInt(line.split('Rows: ')[1]?.split(' ')[0]?.replace(/,/g, '') || '0')
        metrics[currentMetric].count += rows
        if (rows > 0) metrics[currentMetric].status = 'present'
      } else if (currentMetric && line.includes('Range:')) {
        const range = line.split('Range: ')[1]
        if (!metrics[currentMetric].range) metrics[currentMetric].range = range
      }
    })

    return metrics
  }, [parsedFiles])

  if (!stats) return null

  const metricCards = [
    { id: 'steps', name: 'Steps', icon: '🏃' },
    { id: 'sleep', name: 'Sleep', icon: '😴' },
    { id: 'heartrate', name: 'Heart Rate', icon: '❤️' },
    { id: 'hrv', name: 'HRV', icon: '💓' },
    { id: 'weight', name: 'Weight', icon: '⚖️' },
    { id: 'exercise', name: 'Exercise', icon: '💪' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-slide-up">
      {metricCards.map(m => {
        const data = stats[m.id] || stats[m.id.replace('rate', 'Rate')] || { count: 0, status: 'empty' }
        return (
          <div key={m.id} className="bg-ink-soft border border-slate-border rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-xl">{m.icon}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                data.status === 'present' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-slate-ui/10 text-slate-ui/40 border border-slate-border/50'
              }`}>
                {data.status.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-ui font-medium uppercase tracking-wider">{m.name}</p>
              <p className="text-xl font-display font-bold text-white">
                {data.count > 0 ? data.count.toLocaleString() : '--'}
                <span className="text-[10px] font-normal text-slate-ui/60 ml-1">records</span>
              </p>
            </div>
            {data.range && (
              <p className="text-[10px] text-slate-ui/40 font-mono truncate">
                {data.range.split(' to ')[0]}...
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
