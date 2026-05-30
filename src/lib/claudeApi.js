// Claude API integration

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

export async function runAnalysis({ apiKey, parsedFiles, selectedModes, onChunk, onComplete, onError }) {
  const dataBlock = parsedFiles
    .map(f => `\n\n=== FILE: ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB) ===\n${f.summary}`)
    .join('\n')

  const modeInstructions = selectedModes
    .map(m => ANALYSIS_MODES[m])
    .filter(Boolean)
    .map(m => `**${m.label}**: ${m.prompt}`)
    .join('\n\n')

  const systemPrompt = `You are a warm, honest health data analyst. You help people understand their own health data with clarity and care.

IMPORTANT RULES:
- This is NOT medical advice. Always remind the user to discuss clinical findings with their GP.
- Use plain Australian English — warm, direct, never patronising.
- Lead with strengths and reassuring findings before gaps.
- Be honest about data limitations and what can/can't be concluded.
- Format responses with clear markdown headings, use tables where helpful, and keep each section scannable.
- For clinical data (bloodwork, ECG), be especially careful: describe what values mean, flag anything worth GP review, but never diagnose.
- If you see chest pain mentioned alongside data, always include an appropriate clinical caution.
- Acknowledge this is personal data for personal reflection, not a clinical report.`

  const userPrompt = `Please analyse the following health data. Perform these analysis types:\n\n${modeInstructions}\n\n---\n\nHEALTH DATA:\n${dataBlock}\n\n---\n\nBegin your analysis now. Use clear markdown formatting with ## headings for each analysis section.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `API error ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text
              onChunk(fullText)
            }
          } catch {}
        }
      }
    }

    onComplete(fullText)
  } catch (err) {
    onError(err.message)
  }
}

export async function runChat({ apiKey, history, userMessage, dataContext, onChunk, onComplete, onError }) {
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
      ? [{ role: 'user', content: contextMessage + 'I have uploaded health data. Please be ready to answer questions about it.' },
         { role: 'assistant', content: 'Got it — I have your health data loaded and ready. What would you like to explore?' }]
      : []),
    ...history,
    { role: 'user', content: userMessage }
  ]

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `API error ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text
              onChunk(fullText)
            }
          } catch {}
        }
      }
    }

    onComplete(fullText)
  } catch (err) {
    onError(err.message)
  }
}
