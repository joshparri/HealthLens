import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function AnalysisView({ result, streaming }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(result).catch(() => {})
  }

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `health-analysis-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-ink-soft border border-slate-border rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-border bg-ink">
        <div className="flex items-center gap-2">
          {streaming ? (
            <>
              <div className="w-2 h-2 rounded-full bg-jade animate-pulse-slow"></div>
              <span className="text-jade text-xs font-mono">Analysing...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-jade"></div>
              <span className="text-jade text-xs font-mono">Analysis complete</span>
            </>
          )}
        </div>
        {!streaming && result && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="text-xs text-slate-ui hover:text-white border border-slate-border hover:border-jade/40 px-2.5 py-1 rounded-lg transition-all"
            >
              Copy
            </button>
            <button
              onClick={handleDownload}
              className="text-xs text-slate-ui hover:text-white border border-slate-border hover:border-jade/40 px-2.5 py-1 rounded-lg transition-all"
            >
              Download .md
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {!result && streaming && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-6 h-6 border-2 border-jade/30 border-t-jade rounded-full spinner"></div>
            <span className="text-slate-ui text-sm">Loading analysis...</span>
          </div>
        )}

        {result && (
          <div className={`prose-health ${streaming ? 'cursor-blink' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Clinical caution footer */}
      {result && !streaming && (
        <div className="px-5 py-3 border-t border-slate-border bg-amber-glow/30 flex gap-2 items-start">
          <span className="text-amber-health text-sm flex-shrink-0">⚕️</span>
          <p className="text-xs text-amber-health/80 leading-relaxed">
            This analysis is for personal reflection only — not medical advice. Please discuss any clinical findings, symptoms, or concerns with your GP or a qualified health professional.
          </p>
        </div>
      )}
    </div>
  )
}
