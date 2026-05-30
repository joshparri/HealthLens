// File parsing utilities for health data

export async function parseFile(file, onProgress) {
  const ext = file.name.split('.').pop().toLowerCase()
  const result = { name: file.name, type: ext, size: file.size, content: '', summary: '' }
  const log = (msg, status = 'info') => onProgress?.({ file: file.name, msg, status })

  log(`Starting — ${ext.toUpperCase()} file, ${formatFileSize(file.size)}`)

  try {
    if (ext === 'csv') {
      log('Reading text content...')
      result.content = await readText(file)
      const lines = result.content.trim().split('\n')
      log(`Read ${lines.length - 1} rows, ${result.content.length.toLocaleString()} chars`)
      log('Summarising CSV structure...')
      result.summary = summariseCSV(result.content, file.name)
      log(`Done — ${lines.length - 1} data rows extracted`, 'success')

    } else if (ext === 'json') {
      log('Reading JSON...')
      const text = await readText(file)
      result.content = text
      log(`Read ${text.length.toLocaleString()} chars, parsing structure...`)
      result.summary = summariseJSON(text, file.name)
      log('Done — JSON parsed and summarised', 'success')

    } else if (ext === 'txt' || ext === 'md') {
      log('Reading plain text...')
      result.content = await readText(file)
      result.summary = truncate(result.content, 8000)
      log(`Done — ${result.content.length.toLocaleString()} chars read`, 'success')

    } else if (ext === 'pdf') {
      log('Loading PDF library (pdfjs)...')
      result.content = await parsePDF(file, log)
      result.summary = truncate(result.content, 10000)
      log('Done — PDF text extraction complete', 'success')

    } else if (ext === 'zip') {
      log('Loading ZIP library (jszip)...')
      result.content = await parseZIP(file, log)
      result.summary = truncate(result.content, 12000)
      log('Done — ZIP contents extracted', 'success')

    } else if (ext === 'db') {
      log('Loading SQLite engine (sql.js + WASM)...')
      log('This may take 5–10 seconds on first load...')
      result.content = await parseSQLite(file, log)
      result.summary = truncate(result.content, 12000)
      log('Done — SQLite database read', 'success')

    } else {
      log(`Unsupported file type: ${ext}`, 'warn')
      result.content = `[Binary or unsupported file: ${file.name}]`
      result.summary = result.content
    }
  } catch (err) {
    log(`Failed: ${err.message}`, 'error')
    result.content = `[Error parsing ${file.name}: ${err.message}]`
    result.summary = result.content
  }

  return result
}

async function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

function truncate(text, maxChars) {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n\n[...truncated — ${text.length - maxChars} chars omitted for brevity...]`
}

function summariseCSV(text, filename) {
  const lines = text.trim().split('\n')
  const header = lines[0] || ''
  const rowCount = lines.length - 1
  const sample = lines.slice(0, 6).join('\n')
  const tail = lines.slice(-3).join('\n')
  return `CSV FILE: ${filename}\nColumns: ${header}\nTotal rows: ${rowCount}\n\nFirst rows:\n${sample}\n\nLast rows:\n${tail}\n\nFull extract (up to 10000 chars):\n${truncate(text, 10000)}`
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
    log('Importing pdfjs-dist...')
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    log('Loading PDF document...')
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    log(`PDF loaded — ${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}`)

    let fullText = `PDF FILE: ${file.name} (${pdf.numPages} pages)\n\n`
    const pagesToRead = Math.min(pdf.numPages, 30)

    for (let i = 1; i <= pagesToRead; i++) {
      log(`Extracting page ${i} of ${pagesToRead}...`)
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map(item => item.str).join(' ')
      fullText += `--- Page ${i} ---\n${pageText}\n\n`
    }

    return fullText
  } catch (err) {
    return `[PDF parse error for ${file.name}: ${err.message}]`
  }
}

async function parseZIP(file, log) {
  try {
    log('Importing JSZip...')
    const JSZip = (await import('jszip')).default
    log('Unzipping archive...')
    const zip = await JSZip.loadAsync(file)
    const fileList = Object.keys(zip.files)
    log(`Found ${fileList.length} entries in ZIP`)

    let output = `ZIP FILE: ${file.name}\nContents:\n`
    output += fileList.map(f => `  ${f}`).join('\n') + '\n\n'

    let totalChars = 0
    const maxChars = 15000
    let readCount = 0

    for (const filename of fileList) {
      if (totalChars >= maxChars) break
      const zipEntry = zip.files[filename]
      if (zipEntry.dir) continue

      const ext = filename.split('.').pop().toLowerCase()
      if (['csv', 'json', 'txt', 'md', 'xml'].includes(ext)) {
        try {
          log(`Reading ${filename}...`)
          const content = await zipEntry.async('string')
          const snippet = truncate(content, Math.min(3000, maxChars - totalChars))
          output += `\n=== ${filename} ===\n${snippet}\n`
          totalChars += snippet.length
          readCount++
        } catch {
          log(`Could not read ${filename}`, 'warn')
          output += `\n=== ${filename} === [could not read]\n`
        }
      }
    }

    log(`Extracted text from ${readCount} files inside ZIP`)
    return output
  } catch (err) {
    return `[ZIP parse error for ${file.name}: ${err.message}]`
  }
}

async function parseSQLite(file, log) {
  try {
    log('Importing sql.js...')
    const SQL = (await import('sql.js')).default
    log('Fetching WASM binary (may take a moment)...')
    const sqlPromise = SQL({
      locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm`
    })

    const arrayBuffer = await file.arrayBuffer()
    log('Opening SQLite database...')
    const sql = await sqlPromise
    const db = new sql.Database(new Uint8Array(arrayBuffer))

    log('Reading table list...')
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    if (!tablesResult.length) return `SQLite DB: ${file.name}\nNo tables found.`

    const tables = tablesResult[0].values.map(r => r[0])
    log(`Found ${tables.length} table${tables.length !== 1 ? 's' : ''}: ${tables.slice(0, 5).join(', ')}${tables.length > 5 ? '...' : ''}`)

    let output = `SQLITE DB: ${file.name}\nTables (${tables.length}): ${tables.join(', ')}\n\n`

    for (const table of tables.slice(0, 20)) {
      try {
        log(`Reading table: ${table}...`)
        const countResult = db.exec(`SELECT COUNT(*) FROM "${table}"`)
        const count = countResult[0]?.values[0][0] ?? 0
        output += `TABLE: ${table} — ${count} rows\n`

        if (count > 0) {
          const sampleResult = db.exec(`SELECT * FROM "${table}" LIMIT 5`)
          if (sampleResult.length) {
            const cols = sampleResult[0].columns
            const rows = sampleResult[0].values
            output += `Columns: ${cols.join(', ')}\n`
            output += `Sample rows:\n`
            rows.forEach(row => {
              output += `  ${row.map((v, i) => `${cols[i]}=${v}`).join(' | ')}\n`
            })
          }
        }
        output += '\n'
      } catch (e) {
        log(`Error reading table ${table}: ${e.message}`, 'warn')
        output += `TABLE: ${table} — [error: ${e.message}]\n\n`
      }
    }

    db.close()
    return truncate(output, 15000)
  } catch (err) {
    return `[SQLite parse error for ${file.name}: ${err.message}]`
  }
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
