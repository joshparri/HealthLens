import { useState, useCallback } from 'react'
import UploadZone from './components/UploadZone.jsx'
import ModeSelector from './components/ModeSelector.jsx'
import AnalysisView from './components/AnalysisView.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import ApiKeyInput from './components/ApiKeyInput.jsx'
import Header from './components/Header.jsx'
import { parseFile } from './lib/fileParser.js'
import { runAnalysis } from './lib/claudeApi.js'

const STAGES = { SETUP: 'setup', UPLOAD: 'upload', ANALYSE: 'analyse', RESULT: 'result' }

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('jha_api_key') || '')
  const [files, setFiles] = useState([])
  const [parsedFiles, setParsedFiles] = useState([])
  const [parsing, setParsing] = useState(false)
  const [selectedModes, setSelectedModes] = useState(['quickSummary', 'deepPattern'])
  const [stage, setStage] = useState(STAGES.SETUP)
  const [analysisResult, setAnalysisResult] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [showChat, setShowChat] = useState(false)

  const handleApiKey = useCallback((key) => {
    setApiKey(key)
    localStorage.setItem('jha_api_key', key)
    if (key) setStage(STAGES.UPLOAD)
  }, [])

  const handleFiles = useCallback(async (newFiles) => {
    if (!newFiles.length) return
    setParsing(true)
    setError('')
    const parsed = []
    for (const f of newFiles) {
      const result = await parseFile(f)
      parsed.push(result)
    }
    setFiles(prev => [...prev, ...newFiles])
    setParsedFiles(prev => [...prev, ...parsed])
    setParsing(false)
    setStage(STAGES.ANALYSE)
  }, [])

  const removeFile = useCallback((idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setParsedFiles(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleAnalyse = useCallback(async () => {
    if (!apiKey) { setError('Please enter your Claude API key first.'); return }
    if (!parsedFiles.length) { setError('Please upload at least one file.'); return }
    if (!selectedModes.length) { setError('Select at least one analysis mode.'); return }

    setError('')
    setStreaming(true)
    setAnalysisResult('')
    setStage(STAGES.RESULT)
    setChatHistory([])
    setShowChat(false)

    await runAnalysis({
      apiKey,
      parsedFiles,
      selectedModes,
      onChunk: (text) => setAnalysisResult(text),
      onComplete: (text) => {
        setAnalysisResult(text)
        setStreaming(false)
        setShowChat(true)
      },
      onError: (msg) => {
        setError(msg)
        setStreaming(false)
        setStage(STAGES.ANALYSE)
      }
    })
  }, [apiKey, parsedFiles, selectedModes])

  const handleReset = useCallback(() => {
    setFiles([])
    setParsedFiles([])
    setAnalysisResult('')
    setChatHistory([])
    setShowChat(false)
    setError('')
    setStage(apiKey ? STAGES.UPLOAD : STAGES.SETUP)
  }, [apiKey])

  const dataContext = parsedFiles.map(f => f.summary).join('\n\n---\n\n')

  return (
    <div className="min-h-screen bg-ink relative z-10">
      <Header onReset={stage !== STAGES.SETUP && stage !== STAGES.UPLOAD ? handleReset : null} />

      <main className="max-w-5xl mx-auto px-4 pb-24">
        {/* API Key setup */}
        {stage === STAGES.SETUP && (
          <div className="animate-slide-up">
            <div className="text-center pt-16 pb-10">
              <div className="inline-flex items-center gap-2 bg-jade-glow border border-jade/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-jade animate-pulse-slow inline-block"></span>
                <span className="text-jade text-sm font-mono tracking-wider">NOT MEDICAL ADVICE</span>
              </div>
              <h1 className="font-display text-4xl font-bold text-white mb-3 leading-tight">
                Health Data<br/>
                <span className="text-jade">Analyser</span>
              </h1>
              <p className="text-slate-ui text-base max-w-md mx-auto leading-relaxed">
                Upload your wearable exports, pathology reports, and health CSVs.<br/>
                Get deep, honest AI analysis — for personal reflection only.
              </p>
            </div>
            <ApiKeyInput onSubmit={handleApiKey} />
          </div>
        )}

        {/* Upload + Mode select */}
        {(stage === STAGES.UPLOAD || stage === STAGES.ANALYSE) && (
          <div className="animate-slide-up pt-8 space-y-6">
            <UploadZone
              files={files}
              parsedFiles={parsedFiles}
              parsing={parsing}
              onFiles={handleFiles}
              onRemove={removeFile}
            />
            {parsedFiles.length > 0 && (
              <ModeSelector
                selected={selectedModes}
                onChange={setSelectedModes}
                onAnalyse={handleAnalyse}
                disabled={!parsedFiles.length || !apiKey}
              />
            )}
            {error && (
              <div className="bg-crimson-glow border border-crimson-health/30 rounded-xl p-4 text-crimson-health text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Analysis result */}
        {stage === STAGES.RESULT && (
          <div className="animate-slide-up pt-6 space-y-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStage(STAGES.ANALYSE)}
                className="text-slate-ui hover:text-white text-sm flex items-center gap-1.5 transition-colors"
              >
                ← Back
              </button>
              <span className="text-slate-ui text-sm">
                {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''} · {selectedModes.length} mode{selectedModes.length !== 1 ? 's' : ''}
              </span>
            </div>

            <AnalysisView
              result={analysisResult}
              streaming={streaming}
            />

            {error && (
              <div className="bg-crimson-glow border border-crimson-health/30 rounded-xl p-4 text-crimson-health text-sm">
                {error}
              </div>
            )}

            {showChat && (
              <ChatPanel
                apiKey={apiKey}
                history={chatHistory}
                onHistoryUpdate={setChatHistory}
                dataContext={dataContext}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
