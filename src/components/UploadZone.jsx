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

export default function UploadZone({ files, parsedFiles, parsing, onFiles, onRemove }) {
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

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
          ${isDragActive
            ? 'border-jade bg-jade/5 drop-active'
            : 'border-slate-border hover:border-jade/40 hover:bg-jade/2'
          }
        `}
      >
        <input {...getInputProps()} />

        {parsing ? (
          <div className="space-y-3">
            <div className="w-10 h-10 border-2 border-jade/30 border-t-jade rounded-full spinner mx-auto"></div>
            <p className="text-jade text-sm font-mono">Parsing files...</p>
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
                    {parsed && <span className="text-jade ml-2">✓ parsed</span>}
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
