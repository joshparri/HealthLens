import { useState } from 'react'
import db from '../lib/db.js'

const PROVIDERS = ['groq', 'openrouter', 'anthropic']

export default function SettingsPanel({ onClearSession, onClearProviderKeys }) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const clearLocalImports = async () => {
    setBusy(true)
    setStatus('')
    try {
      await Promise.all(db.tables.map((table) => table.clear()))
      setStatus('Local imported health data cleared from this browser.')
      onClearSession?.()
    } catch (error) {
      setStatus(`Could not clear local imports: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const clearProviderKeys = () => {
    PROVIDERS.forEach((provider) => {
      localStorage.removeItem(`jha_key_${provider}`)
      localStorage.removeItem(`jha_model_${provider}`)
    })
    setStatus('AI provider keys cleared from this browser.')
    onClearProviderKeys?.()
  }

  const clearSession = () => {
    onClearSession?.()
    setStatus('Current upload and analysis session cleared.')
  }

  return (
    <div className="bg-ink-soft border border-slate-border rounded-2xl p-6 space-y-6 animate-slide-up">
      <div className="space-y-1">
        <h3 className="font-display font-semibold text-white text-base">Privacy & Settings</h3>
        <p className="text-slate-ui text-xs">Control what stays in this browser.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={clearSession}
          disabled={busy}
          className="rounded-xl border border-slate-border bg-ink px-4 py-4 text-left transition hover:border-jade/30 disabled:opacity-50"
        >
          <span className="block text-sm font-semibold text-white">Clear session</span>
          <span className="mt-2 block text-xs leading-5 text-slate-ui">Removes currently uploaded files and analysis from the page.</span>
        </button>

        <button
          type="button"
          onClick={clearLocalImports}
          disabled={busy}
          className="rounded-xl border border-slate-border bg-ink px-4 py-4 text-left transition hover:border-amber-health/30 disabled:opacity-50"
        >
          <span className="block text-sm font-semibold text-white">Clear local imports</span>
          <span className="mt-2 block text-xs leading-5 text-slate-ui">Clears IndexedDB source/import tables stored in this browser.</span>
        </button>

        <button
          type="button"
          onClick={clearProviderKeys}
          disabled={busy}
          className="rounded-xl border border-slate-border bg-ink px-4 py-4 text-left transition hover:border-crimson-health/30 disabled:opacity-50"
        >
          <span className="block text-sm font-semibold text-white">Clear provider keys</span>
          <span className="mt-2 block text-xs leading-5 text-slate-ui">Removes Groq, OpenRouter, and Anthropic keys from localStorage.</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-border bg-ink p-4 text-xs leading-5 text-slate-ui">
        Files are parsed locally where possible. AI analysis sends the extracted Data Pack to the provider you connect.
        Supabase sync data lives in the configured Supabase project and is not deleted by these local browser controls.
      </div>

      {status && (
        <div className="rounded-xl border border-jade/20 bg-jade/10 p-4 text-sm text-jade">
          {status}
        </div>
      )}
    </div>
  )
}
