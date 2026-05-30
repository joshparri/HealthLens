// SQLite Web Worker — runs sql.js off the main thread
// Receives: { buffer: ArrayBuffer, fileName: string, fileSize: number }
// Posts:    { type: 'progress', msg, status, pct, id }
//           { type: 'done', content }
//           { type: 'error', message }

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function log(msg, status, pct, id) {
  self.postMessage({ type: 'progress', msg: msg, status: status || 'info', pct: pct != null ? pct : null, id: id })
}

self.onmessage = async function(e) {
  var buffer = e.data.buffer
  var fileName = e.data.fileName
  var fileSize = e.data.fileSize

  try {
    log('Step 2/4 — Loading sql.js library...', 'info', 26, 'wasm-load')

    var wasmPct = 26
    var wasmTimer = setInterval(function() {
      if (wasmPct < 43) {
        wasmPct += 1
        var kb = Math.round((wasmPct - 26) / 17 * 2800)
        log('Step 2/4 — Fetching WASM binary... (~' + kb + ' KB of ~2800 KB)', 'info', wasmPct, 'wasm-load')
      }
    }, 180)

    var startWasm = Date.now()
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js')
    var sql = await initSqlJs({
      locateFile: function() { return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm' }
    })

    clearInterval(wasmTimer)
    var wasmMs = Date.now() - startWasm
    log('Step 2/4 — WASM loaded in ' + (wasmMs / 1000).toFixed(1) + 's', 'info', 45, 'wasm-load')

    log('Step 3/4 — Opening SQLite database...', 'info', 46, 'db-open')
    var startOpen = Date.now()
    var db = new sql.Database(new Uint8Array(buffer))
    var openMs = Date.now() - startOpen
    log('Step 3/4 — Database opened in ' + (openMs / 1000).toFixed(1) + 's', 'info', 65, 'db-open')

    log('Step 4/4 — Performing deep data audit...', 'info', 66)
    var tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    var tables = tablesResult[0] ? tablesResult[0].values.map(function(r) { return r[0] }) : []
    
    var dataInventory = {
      fileName: fileName,
      fileSize: formatFileSize(fileSize),
      tablesFound: tables.length,
      metrics: {}
    }

    // Common health metrics and their likely table names/patterns
    var metricMap = {
      steps: ['steps', 'step_count', 'ActivitySamples'],
      sleep: ['sleep', 'sleep_session', 'sleep_stage'],
      hrv: ['hrv', 'heart_rate_variability', 'rmssd'],
      heartRate: ['heart_rate', 'hr_samples', 'resting_heart_rate'],
      weight: ['weight', 'body_mass'],
      exercise: ['exercise', 'workout', 'activity_record'],
      nutrition: ['nutrition', 'food', 'diet'],
      respiratory: ['respiratory', 'breathing']
    }

    for (var i = 0; i < tables.length; i++) {
      var table = tables[i]
      var pct = 66 + Math.round((i / tables.length) * 30)
      log('Step 4/4 — Auditing table [' + (i + 1) + '/' + tables.length + ']: ' + table, 'info', pct)

      try {
        var countResult = db.exec('SELECT COUNT(*) FROM "' + table + '"')
        var count = countResult[0] ? countResult[0].values[0][0] : 0
        
        var schemaResult = db.exec('PRAGMA table_info("' + table + '")')
        var cols = schemaResult[0] ? schemaResult[0].values.map(function(c) { return { name: c[1], type: c[2] } }) : []
        
        var metricKey = 'other'
        for (var key in metricMap) {
          if (metricMap[key].some(function(p) { return table.toLowerCase().indexOf(p) !== -1 })) {
            metricKey = key
            break
          }
        }

        if (!dataInventory.metrics[metricKey]) dataInventory.metrics[metricKey] = []
        
        var stats = { tableName: table, rows: count, status: count > 0 ? 'present' : 'empty' }
        
        if (count > 0) {
          // Detect date ranges
          var dateCol = cols.find(function(c) { 
            var n = c.name.toLowerCase()
            return n.indexOf('time') !== -1 || n.indexOf('date') !== -1 || n.indexOf('stamp') !== -1 
          })
          
          if (dateCol) {
            try {
              var rangeRes = db.exec('SELECT MIN("' + dateCol.name + '"), MAX("' + dateCol.name + '") FROM "' + table + '"')
              if (rangeRes[0]) {
                stats.range = [rangeRes[0].values[0][0], rangeRes[0].values[0][1]]
              }
            } catch(e) {}
          }

          // Source detection (for deduplication audit)
          var sourceCol = cols.find(function(c) { return c.name.toLowerCase().indexOf('source') !== -1 || c.name.toLowerCase().indexOf('package') !== -1 })
          if (sourceCol) {
            try {
              var sourceRes = db.exec('SELECT DISTINCT "' + sourceCol.name + '" FROM "' + table + '" LIMIT 10')
              if (sourceRes[0]) {
                stats.sources = sourceRes[0].values.map(function(v) { return v[0] })
                if (stats.sources.length > 1) {
                  stats.qualityWarning = "Possible duplicate sources: " + stats.sources.join(', ')
                }
              }
            } catch(e) {}
          }

          // Numeric averages for key columns
          var numCols = cols.filter(function(c) {
            var t = c.type.toUpperCase()
            var n = c.name.toLowerCase()
            return (t.indexOf('INT') !== -1 || t.indexOf('FLOAT') !== -1 || t.indexOf('REAL') !== -1) && n.indexOf('id') === -1
          }).slice(0, 3)

          if (numCols.length > 0) {
            var aggQueries = numCols.map(function(c) { return 'AVG("' + c.name + '") as avg_' + c.name }).join(', ')
            try {
              var aggRes = db.exec('SELECT ' + aggQueries + ' FROM "' + table + '"')
              if (aggRes[0]) {
                stats.averages = {}
                aggRes[0].columns.forEach(function(col, ci) {
                  stats.averages[col] = aggRes[0].values[0][ci]
                })
              }
            } catch(e) {}
          }
        }

        dataInventory.metrics[metricKey].push(stats)
      } catch (e) {
        if (!dataInventory.errors) dataInventory.errors = []
        dataInventory.errors.push(table + ": " + e.message)
      }
    }

    db.close()
    
    // Final report construction
    var report = "DATA PACK: STRUCTURED HEALTH INVENTORY\n"
    report += "File: " + dataInventory.fileName + " (" + dataInventory.fileSize + ")\n"
    report += "Tables Found: " + dataInventory.tablesFound + "\n\n"
    
    for (var m in dataInventory.metrics) {
      report += "=== METRIC: " + m.toUpperCase() + " ===\n"
      dataInventory.metrics[m].forEach(function(s) {
        report += "- Table: " + s.tableName + " | Rows: " + s.rows.toLocaleString() + " | Status: " + s.status + "\n"
        if (s.range) report += "  Range: " + s.range[0] + " to " + s.range[1] + "\n"
        if (s.sources) report += "  Sources: " + s.sources.join(', ') + "\n"
        if (s.qualityWarning) report += "  !! QUALITY WARNING: " + s.qualityWarning + "\n"
        if (s.averages) {
          report += "  Averages: " + Object.keys(s.averages).map(function(k) { 
            return k.replace('avg_', '') + ": " + (typeof s.averages[k] === 'number' ? s.averages[k].toFixed(2) : s.averages[k])
          }).join(', ') + "\n"
        }
      })
      report += "\n"
    }

    log('Done — deep audit complete', 'success', 100)
    self.postMessage({ type: 'done', content: report })

  } catch (err) {
    log('Audit failed: ' + err.message, 'error', 100)
    self.postMessage({ type: 'error', message: err.message })
  }
}
