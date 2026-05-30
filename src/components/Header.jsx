export default function Header({ onReset }) {
  return (
    <header className="sticky top-0 z-50 bg-ink/90 backdrop-blur-md border-b border-slate-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 28 28" className="w-7 h-7 flex-shrink-0">
            <rect width="28" height="28" rx="6" fill="#2DD4A020"/>
            <path d="M5 14 L9 9 L13 18 L17 11 L21 14" stroke="#2DD4A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <span className="font-display font-bold text-white text-lg tracking-tight">Health Analyser</span>
          <span className="hidden sm:inline text-xs font-mono text-jade/60 bg-jade-glow px-2 py-0.5 rounded-full">
            personal use only
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-ui hover:text-jade transition-colors hidden sm:block"
          >
            Get API key →
          </a>
          {onReset && (
            <button
              onClick={onReset}
              className="text-xs text-slate-ui hover:text-white border border-slate-border hover:border-jade/40 px-3 py-1.5 rounded-lg transition-all"
            >
              New Analysis
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
