import { useCallback } from 'react'
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

const STATUS_STYLES = {
  info:    'text-slate-ui',
  success: 'text-jade',
  warn:    'text-amber-health',
  error:   'text-crimson-health',
}

const STATUS_PREFIX = {
  info:    '·',
  success: '✓',
  warn:    '⚠',
  error:   '✗',
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

  // Group log lines by file for display
  const currentFile = parseLog.length > 0 ? parseLog[parseLog.length - 1]?.file : null
  const lastStatus = parseLog.length > 0 ? parseLog[parseLog.length - 1]?.status : 'info'

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl transition-all
          ${parsing ? 'border-jade/40 bg-jade/3 cursor-default pointer-events-none' : ''}
          ${!parsing && isDragActive ? 'border-jade bg-jade/5 drop-active p-10 text-center cursor-pointer' : ''}
          ${!parsing && !isDragActive ? 'border-slate-border hover:border-jade/40 hover:bg-jade/2 p-10 text-center cursor-pointer' : ''}
        `}
      >
        <input {...getInputProps()} />

        {parsing ? (
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-slate-border">
              <div className="w-4 h-4 border-2 border-jade/30 border-t-jade rounded-full spinner flex-shrink-0"></div>
              <span className="text-jade text-sm font-mono font-semibold">
                Parsing {currentFile ? `· ${currentFile}` : 'files...'}
              </span>
            </div>

            {/* Live log */}
            <div className="space-y-0.5 max-h-48 overflow-y-auto font-mono text-xs">
              {parseLog.map((entry, i) => {
                const isLast = i === parseLog.length - 1
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 transition-opacity ${
                      isLast ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    {/* File label — only show when it changes */}
                    {(i === 0 || parseLog[i - 1]?.file !== entry.file) && (
                      <span className="text-slate-ui/60 shrink-0 truncate max-w-[120px]" title={entry.file}>
                        {entry.file.length > 16 ? entry.file.slice(0, 14) + '…' : entry.file}
                      </span>
                    )}
                    {(i > 0 && parseLog[i - 1]?.file === entry.file) && (
                      <span className="text-slate-ui/20 shrink-0 w-[120px] max-w-[120px]">│</span>
                    )}
                    <span className={`shrink-0 ${STATUS_STYLES[entry.status] || 'text-slate-ui'}`}>
                      {STATUS_PREFIX[entry.status] || '·'}
                    </span>
                    <span className={`${STATUS_STYLES[entry.status] || 'text-slate-ui'} break-all`}>
                      {entry.msg}
                    </span>
                    {isLast && entry.status === 'info' && (
                      <span className="text-jade animate-pulse shrink-0">▌</span>
                    )}
                  </div>
                )
              })}
            </div>
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
                    {!parsed && parsing && <span className="text-slate-ui ml-2">parsing...</span>}
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
