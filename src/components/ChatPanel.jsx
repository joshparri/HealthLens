import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { runChat } from '../lib/claudeApi.js'

export default function ChatPanel({ apiKey, provider = 'anthropic', model, history, onHistoryUpdate, dataContext }) {
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, streamingText])

  const SUGGESTED = [
    'What should I prioritise this week?',
    'What does my HRV trend suggest?',
    'Is my sleep quality improving?',
    'What gaps in my nutrition should I address?',
    'Are there any red flags I should show my GP?',
    'How does my activity level compare to guidelines?',
  ]

  const send = async (message) => {
    if (!message.trim() || streaming) return
    setInput('')
    setError('')
    setStreaming(true)
    setStreamingText('')

    const userMsg = { role: 'user', content: message }
    onHistoryUpdate(prev => [...prev, userMsg])

    await runChat({
      apiKey,
      provider,
      model,
      history,
      userMessage: message,
      dataContext,
      onChunk: (text) => setStreamingText(text),
      onComplete: (text) => {
        const assistantMsg = { role: 'assistant', content: text }
        onHistoryUpdate(prev => [...prev, assistantMsg])
        setStreamingText('')
        setStreaming(false)
      },
      onError: (msg) => {
        setError(msg)
        setStreaming(false)
        setStreamingText('')
      }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="bg-ink-soft border border-slate-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-border bg-ink flex items-center gap-2">
        <span className="text-base">💬</span>
        <span className="font-display font-semibold text-white text-sm">Ask about your data</span>
        <span className="ml-auto text-xs text-slate-ui">Follow-up questions</span>
      </div>

      {/* Suggested questions (only if no history) */}
      {history.length === 0 && (
        <div className="p-4 border-b border-slate-border">
          <p className="text-xs text-slate-ui mb-3 font-mono uppercase tracking-wide">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={streaming}
                className="text-xs bg-ink border border-slate-border hover:border-jade/40 hover:text-white text-slate-ui px-3 py-1.5 rounded-full transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {history.length > 0 && (
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {history.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`
                flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs
                ${msg.role === 'user' ? 'bg-jade/20 text-jade' : 'bg-ink border border-slate-border text-slate-ui'}
              `}>
                {msg.role === 'user' ? 'J' : '✦'}
              </div>
              <div className={`
                rounded-xl px-4 py-3 max-w-[85%] text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-jade/10 border border-jade/20 text-white'
                  : 'bg-ink border border-slate-border'
                }
              `}>
                {msg.role === 'assistant' ? (
                  <div className="prose-health text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {streaming && streamingText && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-ink border border-slate-border flex items-center justify-center text-xs text-slate-ui">
                ✦
              </div>
              <div className="bg-ink border border-slate-border rounded-xl px-4 py-3 max-w-[85%]">
                <div className="prose-health text-xs cursor-blink">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {streaming && !streamingText && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-ink border border-slate-border flex items-center justify-center">
                <div className="w-3 h-3 border border-jade/30 border-t-jade rounded-full spinner"></div>
              </div>
              <div className="bg-ink border border-slate-border rounded-xl px-4 py-3">
                <span className="text-slate-ui text-xs">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-crimson-glow border-t border-crimson-health/20 text-crimson-health text-xs whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-border flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about your health data..."
          disabled={streaming}
          className="flex-1 bg-ink border border-slate-border focus:border-jade/60 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-slate-border disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="bg-jade hover:bg-jade-dark disabled:opacity-40 disabled:cursor-not-allowed text-ink-DEFAULT font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm flex-shrink-0"
        >
          {streaming ? '...' : 'Ask'}
        </button>
      </form>
    </div>
  )
}
