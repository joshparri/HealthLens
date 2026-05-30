// File parsing utilities for health data

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const result = { name: file.name, type: ext, size: file.size, content: '', summary: '' }

  try {
    if (ext === 'csv') {
      result.content = await readText(file)
      result.summary = summariseCSV(result.content, file.name)
    } else if (ext === 'json') {
      const text = await readText(file)
      result.content = text
      result.summary = summariseJSON(text, file.name)
    } else if (ext === 'txt' || ext === 'md') {
      result.content = await readText(file)
      result.summary = truncate(result.content, 8000)
    } else if (ext === 'pdf') {
      result.content = await parsePDF(file)
      result.summary = truncate(result.content, 10000)
    } else if (ext === 'zip') {
      result.content = await parseZIP(file)
      result.summary = truncate(result.content, 12000)
    } else if (ext === 'db') {
      result.content = await parseSQLite(file)
      result.summary = truncate(result.content, 12000)
    } else {
      result.content = `[Binary or unsupported file: ${file.name}]`
      result.summary = result.content
    }
  } catch (err) {
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

async function parsePDF(file) {
  try {
    // Dynamically import pdfjs
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = `PDF FILE: ${file.name} (${pdf.numPages} pages)\n\n`

    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
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

async function parseZIP(file) {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    let output = `ZIP FILE: ${file.name}\nContents:\n`
    const fileList = Object.keys(zip.files)
    output += fileList.map(f => `  ${f}`).join('\n') + '\n\n'

    let totalChars = 0
    const maxChars = 15000

    for (const filename of fileList) {
      if (totalChars >= maxChars) break
      const zipEntry = zip.files[filename]
      if (zipEntry.dir) continue

      const ext = filename.split('.').pop().toLowerCase()
      if (['csv', 'json', 'txt', 'md', 'xml'].includes(ext)) {
        try {
          const content = await zipEntry.async('string')
          const snippet = truncate(content, Math.min(3000, maxChars - totalChars))
          output += `\n=== ${filename} ===\n${snippet}\n`
          totalChars += snippet.length
        } catch {
          output += `\n=== ${filename} === [could not read]\n`
        }
      }
    }

    return output
  } catch (err) {
    return `[ZIP parse error for ${file.name}: ${err.message}]`
  }
}

async function parseSQLite(file) {
  try {
    const SQL = (await import('sql.js')).default
    const sqlPromise = SQL({
      locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm`
    })

    const arrayBuffer = await file.arrayBuffer()
    const sql = await sqlPromise
    const db = new sql.Database(new Uint8Array(arrayBuffer))

    // Get all tables
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    if (!tablesResult.length) return `SQLite DB: ${file.name}\nNo tables found.`

    const tables = tablesResult[0].values.map(r => r[0])
    let output = `SQLITE DB: ${file.name}\nTables (${tables.length}): ${tables.join(', ')}\n\n`

    for (const table of tables.slice(0, 20)) {
      try {
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
