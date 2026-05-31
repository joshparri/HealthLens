import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function AnalysisView({ result, streaming }) {
  const [copied, setStreaming] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setStreaming(true)
    setTimeout(() => setStreaming(false), 2000)
  }

  const handleDownload = (type = 'md') => {
    let blob, filename
    if (type === 'md') {
      blob = new Blob([result], { type: 'text/markdown' })
      filename = `health-analysis-${new Date().toISOString().split('T')[0]}.md`
    } else {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>HealthLens Analysis</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #1e293b; }
            h1, h2, h3 { color: #0f172a; }
            code { background: #f1f5f9; padding: 2px 4px; rounded: 4px; }
            blockquote { border-left: 4px solid #e2e8f0; margin-left: 0; padding-left: 20px; color: #64748b; }
            .disclaimer { background: #fffbeb; border: 1px solid #fef3c7; padding: 16px; border-radius: 12px; font-size: 0.875rem; color: #92400e; margin-top: 40px; }
          </style>
        </head>
        <body>
          ${result.replace(/\n/g, '<br/>')}
          <div class="disclaimer">
            ⚕️ This analysis is for personal reflection only — not medical advice. Please discuss any clinical findings, symptoms, or concerns with your GP or a qualified health professional.
          </div>
        </body>
        </html>
      `
      blob = new Blob([html], { type: 'text/html' })
      filename = `health-analysis-${new Date().toISOString().split('T')[0]}.html`
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
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
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <div className="flex rounded-lg overflow-hidden border border-slate-border">
              <button
                onClick={() => handleDownload('md')}
                className="text-xs text-slate-ui hover:text-white border-r border-slate-border hover:bg-white/5 px-2.5 py-1 transition-all"
              >
                .MD
              </button>
              <button
                onClick={() => handleDownload('html')}
                className="text-xs text-slate-ui hover:text-white hover:bg-white/5 px-2.5 py-1 transition-all"
              >
                .HTML
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
        <div className="prose-health prose-slate max-w-none animate-fade-in">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {result}
          </ReactMarkdown>
          {streaming && (
            <div className="w-1.5 h-4 bg-jade/40 inline-block ml-1 animate-pulse align-middle"></div>
          )}
        </div>
      </div>
    </div>
  )
}
