import { useState } from 'react'

export default function ApiKeyInput({ onSubmit }) {
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (key.trim()) onSubmit(key.trim())
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-ink-soft border border-slate-border rounded-2xl p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="font-display font-semibold text-white text-lg">Connect Claude API</h2>
          <p className="text-slate-ui text-sm leading-relaxed">
            Your API key is stored locally in your browser and never sent anywhere except directly to Anthropic.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-ink border border-slate-border focus:border-jade/60 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none transition-colors pr-12 placeholder:text-slate-border"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-ui hover:text-white text-xs transition-colors"
            >
              {show ? 'hide' : 'show'}
            </button>
          </div>

          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full bg-jade hover:bg-jade-dark disabled:opacity-40 disabled:cursor-not-allowed text-ink-DEFAULT font-display font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Continue →
          </button>
        </form>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {['CSV', 'PDF', 'SQLite .db', 'ZIP archives', 'JSON', 'Text files'].map(f => (
            <div key={f} className="text-center p-2 bg-ink rounded-lg border border-slate-border/50">
              <span className="text-slate-ui text-xs">{f}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-ui/60 text-center">
          🔒 Key stays in your browser · ⚕️ Not medical advice · 🇦🇺 Plain English output
        </p>
      </div>
    </div>
  )
}
