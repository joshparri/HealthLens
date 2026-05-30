import { useCallback, useRef, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { formatFileSize } from '../lib/fileParser.js'

const TYPE_ICONS = {
  csv: '📊', json: '🔗', pdf: '📄', zip: '🗜️', db: '🗃️',
  txt: '📝', md: '📝', xml: '🔖'
}

const TYPE_COLORS = {
  csv: 'text-jade', json: 'text-amber-health', pdf: 'text-crimson-health',
  zip: 'text-purple-400', db: 'text-blue-400', txt: 'text-slate-ui', md: 'text-slate-ui'
}

const STATUS_COLOR = {
  info:    'text-slate-ui',
  success: 'text-jade',
  warn:    'text-amber-health',
  error:   'text-crimson-health',
}

const STATUS_ICON = {
  info:    '·',
  success: '✓',
  warn:    '⚠',
  error:   '✗',
}


function LogPanel({ parseLog }) {
  const scrollRef = useRef(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const isScrolledToBottom = useRef(true)

  // Auto-scroll to bottom unless user has scrolled up
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!userScrolled) {
      el.scrollTop = el.scrollHeight
    }
  }, [parseLog, userScrolled])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    setUserScrolled(!atBottom)
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setUserScrolled(false)
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-ink rounded-xl border border-slate-border/50 p-3 space-y-1 h-52 overflow-y-auto font-mono text-xs"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {parseLog.length === 0 && (
          <span className="text-slate-ui/40">Waiting for output...</span>
        )}
        {parseLog.map((entry, i) => {
          const isLast = i === parseLog.length - 1
          return (
            <div
              key={i}
              className={`flex items-start gap-2 leading-relaxed ${
                isLast ? 'opacity-100' : 'opacity-45'
              }`}
            >
              <span className="text-slate-ui/40 flex-shrink-0 w-8 text-right tabular-nums">
                {entry.pct != null ? `${Math.round(entry.pct)}%` : ''}
              </span>
              <span className={`flex-shrink-0 ${STATUS_COLOR[entry.status] || 'text-slate-ui'}`}>
                {STATUS_ICON[entry.status] || '·'}
              </span>
              <span className={`break-all ${STATUS_COLOR[entry.status] || 'text-slate-ui'}`}>
                {entry.msg}
              </span>
              {isLast && entry.status === 'info' && (
                <span className="text-jade animate-pulse flex-shrink-0">▌</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Scroll-to-bottom button — only when user has scrolled up */}
      {userScrolled && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 right-2 bg-jade text-ink-DEFAULT text-[10px] font-mono font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 hover:bg-jade-dark transition-colors"
        >
          ↓ latest
        </button>
      )}
    </div>
  )
}

export default function UploadZone({ files, parsedFiles, parsing, parseLog = [], onFiles, onRemove }) {
  const onDrop = useCallback((accepted) => {
    if (accepted.length) onFiles(accepted)
  }, [onFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/x-sqlite3': ['.db'],
      'application/vnd.sqlite3': ['.db'],
      'text/plain': ['.txt', '.md'],
      'application/octet-stream': ['.db'],
    },
    multiple: true,
  })

  // Current state from log
  const lastEntry = parseLog[parseLog.length - 1]
  const currentPct = lastEntry?.pct ?? 0
  const currentStatus = lastEntry?.status ?? 'info'
  const currentFile = lastEntry?.file ?? ''

  // Is it done?
  const isDone = currentStatus === 'success' || currentStatus === 'error'

  // Bar colour
  const barColor = currentStatus === 'error'
    ? 'bg-crimson-health'
    : currentStatus === 'warn'
    ? 'bg-amber-health'
    : 'bg-jade'

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl transition-all
          ${parsing
            ? 'border-jade/40 cursor-default pointer-events-none'
            : isDragActive
            ? 'border-jade bg-jade/5 p-10 text-center cursor-pointer'
            : 'border-slate-border hover:border-jade/40 hover:bg-jade/2 p-10 text-center cursor-pointer'
          }
        `}
      >
        <input {...getInputProps()} />

        {parsing ? (
          <div className="p-4 space-y-4">

            {/* Header with file name + overall pct */}
            <div className="flex items-center gap-3">
              {!isDone && (
                <div className="w-4 h-4 border-2 border-jade/30 border-t-jade rounded-full spinner flex-shrink-0" />
              )}
              {isDone && currentStatus === 'success' && (
                <span className="text-jade text-base flex-shrink-0">✓</span>
              )}
              {isDone && currentStatus === 'error' && (
                <span className="text-crimson-health text-base flex-shrink-0">✗</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-jade text-sm font-mono font-semibold truncate">
                    {currentFile || 'Parsing...'}
                  </span>
                  <span className={`text-xs font-mono font-bold flex-shrink-0 ${STATUS_COLOR[currentStatus]}`}>
                    {currentPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="space-y-1">
              <div className="w-full bg-ink rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${currentPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-ui/50">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Log lines */}
            <LogPanel parseLog={parseLog} />

          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">
              {isDragActive ? '⬇️' : '📂'}
            </div>
            <div>
              <p className="text-white font-display font-semibold text-base mb-1">
                {isDragActive ? 'Drop files here' : 'Drop health files here'}
              </p>
              <p className="text-slate-ui text-sm">
                CSV, PDF, JSON, ZIP, SQLite .db — or click to browse
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {['Health Connect .db', 'Pathology PDFs', 'Wearable CSVs', 'App Exports .zip', 'Withings JSON'].map(t => (
                <span key={t} className="text-xs bg-ink border border-slate-border rounded-full px-2.5 py-0.5 text-slate-ui">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-slate-ui text-xs font-mono uppercase tracking-wider px-1">
            {files.length} file{files.length !== 1 ? 's' : ''} loaded
          </p>
          {files.map((file, idx) => {
            const ext = file.name.split('.').pop().toLowerCase()
            const parsed = parsedFiles[idx]
            const failed = parsed?.summary?.startsWith('[Error')
            return (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center gap-3 bg-ink-soft border border-slate-border rounded-xl px-4 py-3 group animate-fade-in"
              >
                <span className="text-xl flex-shrink-0">{TYPE_ICONS[ext] || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{file.name}</p>
                  <p className={`text-xs font-mono ${TYPE_COLORS[ext] || 'text-slate-ui'}`}>
                    {ext.toUpperCase()} · {formatFileSize(file.size)}
                    {parsed && !failed && <span className="text-jade ml-2">✓ parsed</span>}
                    {parsed && failed && <span className="text-crimson-health ml-2">✗ parse error</span>}
                    {!parsed && parsing && <span className="text-slate-ui ml-2">pending...</span>}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(idx)}
                  className="text-slate-ui hover:text-crimson-health opacity-0 group-hover:opacity-100 transition-all text-lg leading-none flex-shrink-0"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
