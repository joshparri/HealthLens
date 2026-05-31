export async function parseFile(file, onProgress) {
  const ext = file.name.split('.').pop().toLowerCase()
  const result = { name: file.name, type: ext, size: file.size, content: '', summary: '' }

  const log = (msg, status = 'info', pct = null, id = null) =>
    onProgress?.({ file: file.name, msg, status, pct, id })

  log(`Detected ${ext.toUpperCase()} - ${formatFileSize(file.size)}`, 'info', 0)

  try {
    if (ext === 'csv') {
      log('Reading file from disk...', 'info', 5)
      result.content = await readTextWithProgress(file, (p) =>
        log(`Reading file... ${p}%`, 'info', p * 0.6)
      )
      const lines = result.content.trim().split('\n')
      log(`File read - ${lines.length - 1} rows, ${result.content.length.toLocaleString()} chars`, 'info', 65)
      log('Parsing columns and structure...', 'info', 75)
      result.summary = summariseCSV(result.content, file.name)
      log(`Done - ${lines.length - 1} data rows extracted`, 'success', 100)
    } else if (ext === 'json') {
      log('Reading file from disk...', 'info', 5)
      result.content = await readTextWithProgress(file, (p) =>
        log(`Reading file... ${p}%`, 'info', p * 0.6)
      )
      log(`File read - ${result.content.length.toLocaleString()} chars`, 'info', 65)
      log('Parsing JSON structure...', 'info', 75)
      result.summary = summariseJSON(result.content, file.name)
      log('Done - JSON parsed and summarised', 'success', 100)
    } else if (ext === 'txt' || ext === 'md') {
      log('Reading plain text...', 'info', 10)
      result.content = await readTextWithProgress(file, (p) =>
        log(`Reading file... ${p}%`, 'info', p * 0.9)
      )
      result.summary = truncate(result.content, 8000)
      log(`Done - ${result.content.length.toLocaleString()} chars read`, 'success', 100)
    } else if (ext === 'pdf') {
      log('Loading PDF library (pdfjs)...', 'info', 26)
      const content = await parsePDF(file, log)
      result.content = content

      if (content.toLowerCase().includes('pathology') || content.toLowerCase().includes('laboratory')) {
        log('Detected Pathology/Lab report', 'info', 90)
        result.summary = `LAB REPORT DETECTED\n${truncate(content, 5000)}`
      } else {
        result.summary = truncate(content, 10000)
      }
    } else if (ext === 'zip') {
      result.content = await parseZIP(file, log)
      result.summary = truncate(result.content, 16000)

      if (file.name.toLowerCase().includes('withings')) {
        log('Processing Withings export data...', 'info', 31)
        result.summary = `WITHINGS EXPORT\n${result.content}`
      } else if (file.name.toLowerCase().includes('sleep-export')) {
        log('Processing Sleep as Android data...', 'info', 31)
        result.summary = `SLEEP AS ANDROID EXPORT\n${result.content}`
      } else if (file.name.toLowerCase().includes('health_connect') || file.name.toLowerCase().includes('health connect')) {
        log('Processed Health Connect ZIP inventory', 'info', 96)
      }
    } else if (ext === 'db' || ext === 'sqlite') {
      result.content = await parseSQLite(file, log)
      result.summary = truncate(result.content, 16000)
    } else {
      log(`Unsupported file type: ${ext}`, 'warn', 100)
      result.content = `[Binary or unsupported file: ${file.name}]`
      result.summary = result.content
    }
  } catch (err) {
    log(`Failed: ${err.message}`, 'error', 100)
    result.content = `[Error parsing ${file.name}: ${err.message}]`
    result.summary = result.content
  }

  return result
}

async function readTextWithProgress(file, onPct) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) onPct?.(Math.round((e.loaded / e.total) * 100))
    }
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

async function readArrayBufferWithProgress(file, onPct) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) onPct?.(Math.round((e.loaded / e.total) * 100))
    }
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

function truncate(text, maxChars) {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n\n[...truncated - ${text.length - maxChars} chars omitted...]`
}

function summariseCSV(text, filename) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return `CSV FILE: ${filename}\nEmpty or header-only file.`

  const header = lines[0]
  const rowCount = lines.length - 1
  const cols = header.split(',').map(c => c.trim())
  let numericSummary = ''
  const sampleRows = lines.slice(1, 100).map(l => l.split(','))

  cols.forEach((col, ci) => {
    const vals = sampleRows.map(r => parseFloat(r[ci])).filter(v => !isNaN(v))
    if (vals.length > 5) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      numericSummary += `  - ${col}: avg ~${avg.toFixed(2)} (from sample)\n`
    }
  })

  return `CSV FILE: ${filename}
Columns: ${header}
Total rows: ${rowCount}
${numericSummary}
First rows:
${lines.slice(0, 4).join('\n')}

Full extract (up to 8000 chars):
${truncate(text, 8000)}`
}

function summariseJSON(text, filename) {
  try {
    const obj = JSON.parse(text)
    const keys = Array.isArray(obj)
      ? `Array of ${obj.length} items. First item keys: ${obj[0] ? Object.keys(obj[0]).join(', ') : 'n/a'}`
      : `Object keys: ${Object.keys(obj).join(', ')}`
    return `JSON FILE: ${filename}\n${keys}\n\nContent (up to 8000 chars):\n${truncate(text, 8000)}`
  } catch {
    return `JSON FILE (parse error): ${filename}\n${truncate(text, 6000)}`
  }
}

async function parsePDF(file, log) {
  try {
    log('Loading pdfjs-dist library...', 'info', 2)
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => import('pdfjs-dist'))
    const version = pdfjsLib.version || '4.4.168'
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`

    log('Library loaded', 'info', 8)
    log('Reading PDF file from disk...', 'info', 10)
    const arrayBuffer = await readArrayBufferWithProgress(file, (p) =>
      log(`Reading file... ${p}%`, 'info', 10 + p * 0.2)
    )
    log(`File read - ${formatFileSize(file.size)} loaded into memory`, 'info', 30)
    log('Parsing PDF document structure...', 'info', 35)

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      disableWorker: true,
      verbosity: 0,
    }).promise
    log(`Document parsed - ${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''} found`, 'info', 40)

    let fullText = `PDF FILE: ${file.name} (${pdf.numPages} pages)\n\n`
    const pagesToRead = Math.min(pdf.numPages, 30)

    for (let i = 1; i <= pagesToRead; i++) {
      const pct = 40 + Math.round((i / pagesToRead) * 55)
      log(`Extracting text - page ${i} of ${pagesToRead}...`, 'info', pct)
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map(item => item.str).join(' ')
      fullText += `--- Page ${i} ---\n${pageText}\n\n`
    }

    log(`Done - ${fullText.length.toLocaleString()} chars extracted from ${pagesToRead} pages`, 'success', 100)
    return fullText
  } catch (err) {
    log(`PDF parse failed: ${err.message}`, 'error', 100)
    return `[PDF parse error for ${file.name}: ${err.message}]`
  }
}

async function parseZIP(file, log) {
  try {
    log('Loading JSZip library...', 'info', 2)
    const JSZip = (await import('jszip')).default
    log('Library loaded', 'info', 5)

    log('Reading ZIP file from disk...', 'info', 8)
    const arrayBuffer = await readArrayBufferWithProgress(file, (p) =>
      log(`Reading file... ${p}%`, 'info', 8 + p * 0.2)
    )
    log(`File read - ${formatFileSize(file.size)} in memory`, 'info', 28)

    log('Decompressing ZIP archive...', 'info', 30)
    const zip = await JSZip.loadAsync(arrayBuffer)
    const fileList = Object.keys(zip.files)
    const dirs = fileList.filter(f => zip.files[f].dir).length
    const fileCount = fileList.length - dirs
    log(`Archive opened - ${fileCount} files in ${dirs} folders`, 'info', 38)

    let output = `ZIP FILE: ${file.name}\nContents:\n`
    output += fileList.map(f => `  ${f}`).join('\n') + '\n\n'

    const dbCandidates = fileList.filter(f => f.toLowerCase().endsWith('.db') || f.toLowerCase().includes('health_connect'))
    const embeddedDb = dbCandidates.find(f => f.toLowerCase().endsWith('.db')) || dbCandidates[0]
    if (embeddedDb && zip.files[embeddedDb] && !zip.files[embeddedDb].dir) {
      try {
        log(`Found embedded DB: ${embeddedDb} - extracting structured Health Connect inventory`, 'info', 50)
        const arrayBuf = await zip.files[embeddedDb].async('arraybuffer')
        const dbFile = new File([arrayBuf], embeddedDb.split('/').pop(), { type: 'application/octet-stream' })
        const dbReport = await parseSQLite(dbFile, log)
        output += `\n=== Embedded DB: ${embeddedDb} ===\n${dbReport}\n`
      } catch (e) {
        log(`Could not extract embedded DB ${embeddedDb}: ${e.message}`, 'warn')
        output += `\n=== Embedded DB: ${embeddedDb} could not be extracted ===\n`
      }
    }

    const priorityKeywords = ['sleep', 'weight', 'height', 'activity', 'hrv', 'heart_rate', 'bp', 'glucose']
    let totalChars = 0
    const maxChars = 20000
    const readable = fileList.filter(f => {
      if (zip.files[f].dir) return false
      const ext = f.split('.').pop().toLowerCase()
      return ['csv', 'json', 'txt', 'md', 'xml'].includes(ext)
    }).sort((a, b) => {
      const aLow = a.toLowerCase()
      const bLow = b.toLowerCase()
      const aPri = priorityKeywords.some(k => aLow.includes(k))
      const bPri = priorityKeywords.some(k => bLow.includes(k))
      if (aPri && !bPri) return -1
      if (!aPri && bPri) return 1
      return 0
    })

    log(`Found ${readable.length} readable text files inside ZIP`, 'info', 42)

    for (let i = 0; i < readable.length; i++) {
      if (totalChars >= maxChars) {
        log(`Character limit reached - skipping remaining ${readable.length - i} files`, 'warn', 95)
        break
      }
      const filename = readable[i]
      const pct = 42 + Math.round((i / Math.max(1, readable.length)) * 52)
      log(`[${i + 1}/${readable.length}] Reading ${filename.split('/').pop()}...`, 'info', pct)
      try {
        const content = await zip.files[filename].async('string')
        const isPriority = priorityKeywords.some(k => filename.toLowerCase().includes(k))
        const snippetLimit = isPriority ? 5000 : 2000
        const snippet = truncate(content, Math.min(snippetLimit, maxChars - totalChars))
        output += `\n=== ${filename} ===\n${snippet}\n`
        totalChars += snippet.length
      } catch {
        log(`Could not read ${filename}`, 'warn', pct)
        output += `\n=== ${filename} === [could not read]\n`
      }
    }

    log(`Done - extracted ${totalChars.toLocaleString()} chars from ${readable.length} files`, 'success', 100)
    return output
  } catch (err) {
    log(`ZIP parse failed: ${err.message}`, 'error', 100)
    return `[ZIP parse error for ${file.name}: ${err.message}]`
  }
}

async function parseSQLite(file, log) {
  log('Step 1/4 - Reading file into browser memory...', 'info', 0)
  let arrayBuffer
  try {
    const startRead = Date.now()
    arrayBuffer = await readArrayBufferWithProgress(file, (p) => {
      const mb = ((file.size * p / 100) / 1024 / 1024).toFixed(1)
      log(`Step 1/4 - Reading file: ${p}% (${mb} MB of ${formatFileSize(file.size)})`, 'info', p * 0.25)
    })
    const readMs = Date.now() - startRead
    log(`Step 1/4 - File read complete in ${(readMs / 1000).toFixed(1)}s`, 'info', 25)
  } catch (err) {
    log(`Step 1/4 - Failed to read file: ${err.message}`, 'error', 100)
    return `[SQLite read error for ${file.name}: ${err.message}]`
  }

  return new Promise((resolve) => {
    let worker
    try {
      worker = new Worker('/sqlite-worker.js')
    } catch (err) {
      log(`Worker unavailable: ${err.message}. Falling back to main thread...`, 'warn', 26)
      resolve(parseSQLiteFallback(file, arrayBuffer, log))
      return
    }

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        log(msg.msg, msg.status, msg.pct, msg.id)
      } else if (msg.type === 'done') {
        worker.terminate()
        resolve(msg.content)
      } else if (msg.type === 'error') {
        worker.terminate()
        log(`SQLite parse failed: ${msg.message}`, 'error', 100)
        resolve(`[SQLite parse error for ${file.name}: ${msg.message}]`)
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      log(`Worker crashed: ${err.message}`, 'error', 100)
      resolve(`[SQLite worker error for ${file.name}: ${err.message}]`)
    }

    worker.postMessage({ buffer: arrayBuffer, fileName: file.name, fileSize: file.size }, [arrayBuffer])
  })
}

async function parseSQLiteFallback(file, arrayBuffer, log) {
  try {
    log('Step 2/4 - Loading sql.js library...', 'info', 26)
    const SQL = (await import('sql.js')).default

    const sql = await SQL({ locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm` })
    log('Step 2/4 - WASM loaded', 'info', 45)

    log('Step 3/4 - Opening SQLite database...', 'info', 46)
    const db = new sql.Database(new Uint8Array(arrayBuffer))
    log('Step 3/4 - Database opened', 'info', 65)

    log('Step 4/4 - Querying table list...', 'info', 66)
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    if (!tablesResult.length) {
      db.close()
      return `SQLite DB: ${file.name}\nNo tables found.`
    }

    const tables = tablesResult[0].values.map(r => r[0])
    const toRead = tables.slice(0, 75)
    log(`Step 4/4 - Found ${tables.length} tables: ${toRead.slice(0, 6).join(', ')}`, 'info', 68)

    let output = `DATA PACK: STRUCTURED HEALTH INVENTORY
File: ${file.name} (${formatFileSize(file.size)})
Parser: main-thread fallback
Tables Found: ${tables.length}

IMPORTANT: Fallback parser reports schema/counts only. Worker parser gives richer aggregate summaries.

`
    for (let i = 0; i < toRead.length; i++) {
      const table = toRead[i]
      const pct = 68 + Math.round((i / Math.max(1, toRead.length)) * 28)
      log(`Step 4/4 - [${i + 1}/${toRead.length}] Reading: ${table}`, 'info', pct)
      try {
        const cr = db.exec(`SELECT COUNT(*) FROM "${table.replace(/"/g, '""')}"`)
        const count = cr[0]?.values[0][0] ?? 0
        const schema = db.exec(`PRAGMA table_info("${table.replace(/"/g, '""')}")`)
        const columns = schema[0] ? schema[0].values.map(row => row[1]).join(', ') : 'unknown'
        output += `TABLE: ${table} - ${Number(count).toLocaleString()} rows\nColumns: ${columns}\n\n`
      } catch (e) {
        output += `TABLE: ${table} - [error: ${e.message}]\n\n`
      }
    }
    db.close()
    const result = truncate(output, 18000)
    log(`Done - ${toRead.length} tables summarised, ${result.length.toLocaleString()} chars extracted`, 'success', 100)
    return result
  } catch (err) {
    log(`SQLite parse failed: ${err.message}`, 'error', 100)
    return `[SQLite parse error for ${file.name}: ${err.message}]`
  }
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
