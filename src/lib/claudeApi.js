// Multi-provider AI integration: Anthropic, Groq, OpenRouter
import { SOURCE_PRIORITY } from './schema.js'

const ENDPOINTS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

const ANALYSIS_MODES = {
  quickSummary: {
    label: 'Quick Summary',
    icon: '⚡',
    prompt: 'Give a clear, plain-English overview of this health data. Highlight the 3-5 most important findings. Be warm and honest. Use Australian English.'
  },
  deepPattern: {
    label: 'Deep Pattern Analysis',
    icon: '🔬',
    prompt: 'Perform a deep pattern analysis. Look for trends over time, correlations between metrics, anomalies, and boom-bust cycles. What stories does this data tell?'
  },
  clinicalReview: {
    label: 'Clinical Records',
    icon: '🩺',
    prompt: 'Review any pathology, blood test, or clinical records in this data. Summarise what each marker means in plain English, flag anything worth discussing with a GP, and note positive findings too. Remind the user this is not medical advice.'
  },
  sleepAnalysis: {
    label: 'Sleep Analysis',
    icon: '🌙',
    prompt: 'Focus specifically on sleep data. Analyse duration, timing/consistency, quality indicators, and how sleep appears to affect next-day metrics. What patterns suggest good or poor sleep hygiene?'
  },
  movementBreakdown: {
    label: 'Movement & Exercise',
    icon: '🏃',
    prompt: 'Break down movement and exercise data. What types of activity are present? How does activity load vary? Are there gaps (e.g. strength training)? How does this compare to Australian adult movement guidelines?'
  },
  recoveryHRV: {
    label: 'Recovery & HRV',
    icon: '💓',
    prompt: 'Analyse recovery signals including HRV, resting heart rate, respiratory rate, and any other recovery metrics. What is the overall recovery picture? Any concerning trends or reassuring signals?'
  },
  nutritionGaps: {
    label: 'Nutrition Gaps',
    icon: '🥗',
    prompt: 'Analyse any nutrition data present. If no direct intake data, look for indirect signals (weight trends, energy markers, bloodwork suggesting nutritional status). Flag any likely gaps for a dairy-free, plant-forward diet.'
  },
  actionPlan: {
    label: '90-Day Action Plan',
    icon: '🎯',
    prompt: 'Based on all the data, generate a practical 90-day action plan. Keep it small and realistic — assume a real life with family, work, and ADHD. Prioritise the highest-yield changes. Format as clear weekly priorities.'
  },
  comparePeriods: {
    label: 'Compare Time Periods',
    icon: '📊',
    prompt: 'Compare health metrics across different time periods in the data. Look for what has improved, what has stayed flat, and what may have declined. Frame improvements as encouragement.'
  }
}

export { ANALYSIS_MODES }

// ─── Internal streaming helpers ───────────────────────────────────────────────

async function streamResponse({ provider, model, apiKey, systemPrompt, messages, onChunk, onComplete, onError }) {
  try {
    let response

    if (provider === 'anthropic') {
      response = await fetch(ENDPOINTS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          system: systemPrompt,
          messages,
        }),
      })
    } else {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin
        headers['X-Title'] = 'HealthLens'
      }
      response = await fetch(ENDPOINTS[provider], {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      })
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || errorData.message || `API error ${response.status}: ${response.statusText}`
      throw new Error(`${provider} error: ${errorMessage}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue
        try {
          const parsed = JSON.parse(trimmed.slice(6))
          let chunk = ''
          if (provider === 'anthropic') {
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              chunk = parsed.delta.text
            }
          } else {
            chunk = parsed.choices?.[0]?.delta?.content ?? ''
          }
          if (chunk) {
            fullText += chunk
            onChunk(fullText)
          }
        } catch {}
      }
    }

    onComplete(fullText)
  } catch (err) {
    onError(err.message)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkHealth({ provider, model, apiKey }) {
  try {
    const systemPrompt = "Health check. Respond with 'OK'."
    const messages = [{ role: 'user', content: 'Are you there?' }]
    
    let response
    if (provider === 'anthropic') {
      response = await fetch(ENDPOINTS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages,
          system: systemPrompt,
        }),
      })
    } else {
      response = await fetch(ENDPOINTS[provider], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      })
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || errorData.message || `API error ${response.status}`
      return { ok: false, message: errorMessage }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

export async function runAnalysis({ apiKey, provider = 'anthropic', model = 'claude-opus-4-5', parsedFiles, selectedModes, onChunk, onComplete, onError }) {
  const dataBlock = parsedFiles
    .map(f => `\n\n=== FILE: ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB) ===\n${f.summary}`)
    .join('\n')

  const modeInstructions = selectedModes
    .map(m => ANALYSIS_MODES[m])
    .filter(Boolean)
    .map(m => `**${m.label}**: ${m.prompt}`)
    .join('\n\n')

  const systemPrompt = `You are a senior health data analyst. You are analysing a structured health-data extraction (Data Pack), not raw files.

SOURCE PRIORITY RULES:
${Object.entries(SOURCE_PRIORITY).map(([metric, sources]) => `- ${metric}: ${sources.join(' > ')}`).join('\n')}

IMPORTANT RULES:
- Use the SOURCE PRIORITY RULES above to decide which data to trust if multiple sources provide the same metric.
- Do not invent data. If the Data Pack says a metric has 0 rows, it is empty.
- Do not say a metric is missing if the Data Pack shows rows exist.
- Every major claim must reference the extracted metric, date range, row count, or quality warning.
- Warn when duplication or source overlap may distort totals (e.g. if multiple apps contribute to the same metric).
- If a table exists with 0 rows, say "table exists but contains no records".
- If a parser failed, say "parser limitation", not "data absent".
- Use plain Australian English — warm, direct, never patronising.
- This is NOT medical advice. Always suggest discussing findings with a GP.

RESPONSE STRUCTURE:
1. **Data Inventory**: Summarise files, tables, metrics, date ranges, and row counts.
2. **Data Quality Audit**: Highlight duplicates, source overlap, missing metrics, and confidence ratings.
3. **True Summary**: What can safely be concluded vs what is uncertain.
4. **Metric-by-Metric Analysis**: Detailed findings for Steps, Sleep, HRV, Resting HR, etc.
5. **Pattern Lenses**: Insights on Recovery, Longevity, and ADHD/Regulation if applicable.
6. **Next Experiments**: 1–3 tiny, practical experiments with success measures.`

  const userPrompt = `Please perform a deep clinical and pattern analysis on this Health Data Pack.

HEALTH DATA PACK:
${dataBlock}

---

Begin your structured analysis now. Lead with the Data Inventory.`

  await streamResponse({
    provider,
    model,
    apiKey,
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    onChunk,
    onComplete,
    onError,
  })
}

export async function runChat({ apiKey, provider = 'anthropic', model = 'claude-opus-4-5', history, userMessage, dataContext, onChunk, onComplete, onError }) {
  const systemPrompt = `You are a warm, honest health data analyst helping someone understand their personal health data.

Key rules:
- Use plain Australian English
- Not medical advice — always suggest GP for clinical concerns
- Be warm, practical, and direct
- The user has already uploaded health data (context provided)
- Answer follow-up questions clearly and concisely`

  const contextMessage = dataContext
    ? `[HEALTH DATA CONTEXT]\n${dataContext.slice(0, 8000)}\n[END CONTEXT]\n\n`
    : ''

  const messages = [
    ...(history.length === 0 && dataContext
      ? [
          { role: 'user', content: contextMessage + 'I have uploaded health data. Please be ready to answer questions about it.' },
          { role: 'assistant', content: 'Got it — I have your health data loaded and ready. What would you like to explore?' }
        ]
      : []),
    ...history,
    { role: 'user', content: userMessage }
  ]

  await streamResponse({
    provider,
    model,
    apiKey,
    systemPrompt,
    messages,
    onChunk,
    onComplete,
    onError,
  })
}
