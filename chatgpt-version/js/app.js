const state = {
  files: [],
  records: [],
  daily: new Map(),
  lastReport: '',
};

const METRIC_DEFS = {
  steps: { label: 'Steps', unit: 'steps', better: 'higher', category: 'activity' },
  distance_km: { label: 'Distance', unit: 'km', better: 'context', category: 'activity' },
  active_zone_minutes: { label: 'Active minutes', unit: 'min', better: 'higher', category: 'exercise' },
  exercise_minutes: { label: 'Exercise minutes', unit: 'min', better: 'context', category: 'exercise' },
  sleep_hours: { label: 'Sleep', unit: 'h', better: 'range', category: 'sleep' },
  sleep_efficiency: { label: 'Sleep efficiency', unit: '%', better: 'higher', category: 'sleep' },
  hrv_rmssd_ms: { label: 'HRV', unit: 'ms', better: 'higher', category: 'recovery' },
  resting_hr_bpm: { label: 'Resting HR', unit: 'bpm', better: 'lower', category: 'recovery' },
  respiratory_rate_bpm: { label: 'Respiratory rate', unit: '/min', better: 'range', category: 'recovery' },
  weight_kg: { label: 'Weight', unit: 'kg', better: 'context', category: 'body' },
  systolic_bp: { label: 'Systolic BP', unit: 'mmHg', better: 'range', category: 'clinical' },
  diastolic_bp: { label: 'Diastolic BP', unit: 'mmHg', better: 'range', category: 'clinical' },
  glucose_mmol_l: { label: 'Glucose', unit: 'mmol/L', better: 'range', category: 'clinical' },
  pdf_note: { label: 'PDF note', unit: 'text', better: 'context', category: 'document' },
};

const LENSES = [
  { id: 'plain', name: 'Plain-English Summary', desc: 'What is strong, what is concerning, what is unknown, and what to do next.' },
  { id: 'medical', name: 'Medical Safety Boundary', desc: 'Separates pattern analysis from GP/clinical interpretation.' },
  { id: 'sleep', name: 'Sleep Lens', desc: 'Duration, rhythm, consistency, efficiency and source conflicts.' },
  { id: 'recovery', name: 'Recovery / Nervous System', desc: 'HRV, resting HR, respiratory rate and under-recovery signals.' },
  { id: 'exercise', name: 'Exercise Science', desc: 'Steps, structured cardio, activity load, intensity and strength gap.' },
  { id: 'longevity', name: 'Longevity / Preventive Health', desc: 'Healthspan pillars: movement, strength, cardio, sleep, stress and data gaps.' },
  { id: 'adhd', name: 'ADHD / Regulation', desc: 'How rhythms may affect attention, emotional steadiness and embodied regulation.' },
  { id: 'family', name: 'Family / Work Sustainability', desc: 'Whether the pattern supports calm, presence and sustainable output.' },
  { id: 'faith', name: 'Faith / Character', desc: 'Optional stewardship lens: peace, patience, self-control and presence.' },
  { id: 'bluezones', name: 'Blue Zones / Lifestyle', desc: 'Natural movement, belonging, downshift, routine and simple repeatable habits.' },
  { id: 'blueprint', name: 'Blueprint / Optimisation', desc: 'Practical minimum-effective-dose optimisation without obsession.' },
  { id: 'correlation', name: 'Correlation and Lag', desc: 'What moves together, cautiously and without claiming causation.' },
  { id: 'anomaly', name: 'Anomaly Lens', desc: 'Outliers, possible device errors and signals worth watching.' },
];

const els = {
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  fileCount: document.getElementById('fileCount'),
  recordCount: document.getElementById('recordCount'),
  dateRange: document.getElementById('dateRange'),
  snapshotCards: document.getElementById('snapshotCards'),
  snapshotConfidence: document.getElementById('snapshotConfidence'),
  chartMetric: document.getElementById('chartMetric'),
  chart: document.getElementById('chart'),
  plainSummary: document.getElementById('plainSummary'),
  fileTable: document.querySelector('#fileTable tbody'),
  qualityReport: document.getElementById('qualityReport'),
  lensGrid: document.getElementById('lensGrid'),
  experimentsList: document.getElementById('experimentsList'),
  questionInput: document.getElementById('questionInput'),
  answerBox: document.getElementById('answerBox'),
};

init();

function init() {
  bindEvents();
  renderLensGrid();
  restore();
  renderAll();
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  }));

  els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('dragover'); });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('dragover'));
  els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); els.dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files);
  });
  els.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!confirm('Clear locally stored health data from this browser?')) return;
    state.files = []; state.records = []; state.daily = new Map(); localStorage.removeItem('jhl-state'); renderAll();
  });
  document.getElementById('exportBtn').addEventListener('click', exportReport);
  document.getElementById('sampleBtn').addEventListener('click', loadSample);
  document.getElementById('runAllBtn').addEventListener('click', runAllLenses);
  document.getElementById('askBtn').addEventListener('click', answerQuestion);
  els.questionInput.addEventListener('keydown', e => { if (e.key === 'Enter') answerQuestion(); });
  els.chartMetric.addEventListener('change', () => renderChart(els.chartMetric.value));
}

async function handleFiles(fileList) {
  for (const file of Array.from(fileList)) {
    const inventory = createInventory(file);
    state.files.push(inventory);
    try {
      if (/\.csv$/i.test(file.name)) await parseCsvFile(file, inventory);
      else if (/\.json$/i.test(file.name)) await parseJsonFile(file, inventory);
      else if (/\.(txt|md)$/i.test(file.name)) await parseTextFile(file, inventory);
      else if (/\.pdf$/i.test(file.name)) await parsePdfFile(file, inventory);
      else if (/\.(db|sqlite)$/i.test(file.name)) await parseSqliteFile(file, inventory);
      else if (/\.zip$/i.test(file.name)) {
        inventory.detectedType = 'ZIP archive';
        inventory.warnings.push('ZIP unpacking is not implemented in-browser yet. Unzip first, then upload the CSV/JSON/DB/PDF files.');
        inventory.confidence = 'low';
      } else {
        inventory.detectedType = 'Unknown health file';
        inventory.warnings.push('Unsupported file extension. Stored in inventory only.');
        inventory.confidence = 'low';
      }
    } catch (err) {
      inventory.warnings.push(`Parse failed: ${err.message}`);
      inventory.confidence = 'low';
    }
  }
  rebuildDaily();
  persist();
  renderAll();
}

function createInventory(file) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name: file.name,
    size: file.size,
    detectedType: detectTypeFromName(file.name),
    metrics: [],
    dateMin: null,
    dateMax: null,
    confidence: 'medium',
    warnings: [],
    createdAt: new Date().toISOString(),
  };
}

function detectTypeFromName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.db') || lower.endsWith('.sqlite')) return 'Health Connect SQLite candidate';
  if (lower.includes('withings')) return 'Withings export candidate';
  if (lower.includes('fitbit')) return 'Fitbit export candidate';
  if (lower.includes('welltory')) return 'Welltory export candidate';
  if (lower.includes('sleep')) return 'Sleep data candidate';
  if (lower.includes('blood') || lower.includes('pathology')) return 'Pathology/clinical PDF candidate';
  if (lower.includes('ecg')) return 'ECG PDF candidate';
  if (lower.endsWith('.csv')) return 'CSV health export';
  if (lower.endsWith('.pdf')) return 'Health PDF candidate';
  return 'Unknown';
}

async function readText(file) { return await file.text(); }

async function parseCsvFile(file, inventory) {
  inventory.detectedType = refineCsvType(file.name);
  const text = await readText(file);
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('No rows found');
  const headers = Object.keys(rows[0]);
  const dateKey = pick(headers, ['date', 'day', 'local_date', 'start_date', 'timestamp', 'time']);
  if (!dateKey) throw new Error('No obvious date column');
  rows.forEach(row => {
    const date = normaliseDate(row[dateKey]);
    if (!date) return;
    headers.forEach(h => {
      if (h === dateKey) return;
      const value = Number(String(row[h]).replace(/,/g, ''));
      if (!Number.isFinite(value)) return;
      const metric = inferMetric(h);
      if (!metric) return;
      addRecord({ date, metric, value, unit: METRIC_DEFS[metric]?.unit || '', source: file.name, confidence: 'medium', raw: h, category: METRIC_DEFS[metric]?.category || 'unknown' });
    });
  });
  finishInventory(inventory, state.records.filter(r => r.source === file.name));
}

function refineCsvType(name) {
  const lower = name.toLowerCase();
  if (lower.includes('daily_metrics')) return 'Daily health metrics CSV';
  if (lower.includes('fitbit')) return 'Fitbit CSV';
  if (lower.includes('withings')) return 'Withings CSV';
  if (lower.includes('welltory')) return 'Welltory CSV';
  return 'CSV health export';
}

async function parseJsonFile(file, inventory) {
  inventory.detectedType = 'JSON health export';
  const obj = JSON.parse(await readText(file));
  const rows = Array.isArray(obj) ? obj : Array.isArray(obj.records) ? obj.records : Array.isArray(obj.data) ? obj.data : [];
  if (!rows.length) throw new Error('JSON did not contain an array, data[], or records[]');
  const headers = Object.keys(rows[0] || {});
  const dateKey = pick(headers, ['date', 'day', 'local_date', 'start_time', 'timestamp', 'time']);
  if (!dateKey) throw new Error('No obvious date field');
  rows.forEach(row => {
    const date = normaliseDate(row[dateKey]);
    if (!date) return;
    headers.forEach(h => {
      if (h === dateKey) return;
      const value = Number(row[h]);
      const metric = inferMetric(h);
      if (metric && Number.isFinite(value)) addRecord({ date, metric, value, unit: METRIC_DEFS[metric]?.unit || '', source: file.name, confidence: 'medium', raw: h, category: METRIC_DEFS[metric]?.category || 'unknown' });
    });
  });
  finishInventory(inventory, state.records.filter(r => r.source === file.name));
}

async function parseTextFile(file, inventory) {
  inventory.detectedType = /\.md$/i.test(file.name) ? 'Markdown notes/report' : 'Text notes/report';
  const text = await readText(file);
  extractTextHealthHints(text, file.name);
  finishInventory(inventory, state.records.filter(r => r.source === file.name));
  if (!inventory.metrics.length) inventory.warnings.push('No structured metrics detected. Stored as narrative context only.');
}

async function parsePdfFile(file, inventory) {
  inventory.detectedType = detectTypeFromName(file.name).includes('candidate') ? detectTypeFromName(file.name).replace(' candidate', '') : 'PDF health document';
  try {
    await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    const pages = Math.min(pdf.numPages, 20);
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += '\n' + content.items.map(item => item.str).join(' ');
    }
    if (pdf.numPages > pages) inventory.warnings.push(`Only first ${pages} pages parsed in-browser.`);
    extractTextHealthHints(text, file.name);
    const recs = state.records.filter(r => r.source === file.name);
    if (!recs.length) addRecord({ date: todayISO(), metric: 'pdf_note', value: 1, unit: 'text', source: file.name, confidence: 'low', raw: text.slice(0, 500), category: 'document' });
    finishInventory(inventory, state.records.filter(r => r.source === file.name));
  } catch (err) {
    inventory.warnings.push(`PDF text extraction unavailable: ${err.message}`);
    inventory.confidence = 'low';
  }
}

async function parseSqliteFile(file, inventory) {
  inventory.detectedType = 'Health Connect SQLite database';
  if (file.size > 90 * 1024 * 1024) inventory.warnings.push('Large database: browser parsing may be slow. Use tools/extract_health_connect.py for reliable local extraction if the page struggles.');
  await loadSqlJs();
  const buffer = await file.arrayBuffer();
  const db = new window.SQL.Database(new Uint8Array(buffer));
  const tables = listTables(db);
  if (!tables.includes('steps_record_table')) inventory.warnings.push('No Health Connect steps_record_table found; schema may differ.');

  runHealthConnectExtractors(db, file.name, inventory, tables);
  finishInventory(inventory, state.records.filter(r => r.source === file.name));
  db.close();
}

function runHealthConnectExtractors(db, source, inventory, tables) {
  const has = (t) => tables.includes(t);
  if (has('steps_record_table')) queryRows(db, `select local_date, max(value) as value from (select app_info_id, local_date, sum(count) as value from steps_record_table group by app_info_id, local_date) group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'steps', value: row.value, unit: 'steps', source, confidence: 'high', raw: 'steps_record_table', category: 'activity' }));
  if (has('distance_record_table')) queryRows(db, `select local_date, max(value) as value from (select app_info_id, local_date, sum(distance) / 1000.0 as value from distance_record_table group by app_info_id, local_date) group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'distance_km', value: row.value, unit: 'km', source, confidence: 'medium', raw: 'distance_record_table', category: 'activity' }));
  if (has('sleep_session_record_table')) queryRows(db, `select local_date, max(duration) as value from (select local_date, (end_time - start_time) / 3600000.0 as duration from sleep_session_record_table where (end_time - start_time) / 3600000.0 between 3 and 14) group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'sleep_hours', value: row.value, unit: 'h', source, confidence: 'medium', raw: 'sleep_session_record_table', category: 'sleep' }));
  if (has('heart_rate_variability_rmssd_record_table')) queryRows(db, `select local_date, avg(heart_rate_variability_millis) as value from heart_rate_variability_rmssd_record_table group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'hrv_rmssd_ms', value: row.value, unit: 'ms', source, confidence: 'medium', raw: 'heart_rate_variability_rmssd_record_table', category: 'recovery' }));
  if (has('resting_heart_rate_record_table')) queryRows(db, `select local_date, avg(beats_per_minute) as value from resting_heart_rate_record_table group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'resting_hr_bpm', value: row.value, unit: 'bpm', source, confidence: 'medium', raw: 'resting_heart_rate_record_table', category: 'recovery' }));
  if (has('respiratory_rate_record_table')) queryRows(db, `select local_date, avg(rate) as value from respiratory_rate_record_table group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'respiratory_rate_bpm', value: row.value, unit: '/min', source, confidence: 'medium', raw: 'respiratory_rate_record_table', category: 'recovery' }));
  if (has('weight_record_table')) queryRows(db, `select local_date, case when avg(weight) > 300 then avg(weight)/1000.0 else avg(weight) end as value from weight_record_table group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'weight_kg', value: row.value, unit: 'kg', source, confidence: 'medium', raw: 'weight_record_table', category: 'body' }));
  if (has('exercise_session_record_table')) queryRows(db, `select local_date, max(value) as value from (select app_info_id, local_date, sum((end_time - start_time) / 60000.0) as value from exercise_session_record_table group by app_info_id, local_date) group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'exercise_minutes', value: row.value, unit: 'min', source, confidence: 'medium', raw: 'exercise_session_record_table', category: 'exercise' }));
  if (has('activity_intensity_record_table')) queryRows(db, `select local_date, sum((end_time - start_time) / 60000.0) as value from activity_intensity_record_table group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'active_zone_minutes', value: row.value, unit: 'min', source, confidence: 'low', raw: 'activity_intensity_record_table approximation', category: 'exercise' }));
  if (has('blood_pressure_record_table')) queryRows(db, `select local_date, avg(systolic) as sys, avg(diastolic) as dia from blood_pressure_record_table group by local_date`, row => { if (row.sys) addRecord({ date: epochDayToISO(row.local_date), metric: 'systolic_bp', value: row.sys, unit: 'mmHg', source, confidence: 'medium', raw: 'blood_pressure_record_table', category: 'clinical' }); if (row.dia) addRecord({ date: epochDayToISO(row.local_date), metric: 'diastolic_bp', value: row.dia, unit: 'mmHg', source, confidence: 'medium', raw: 'blood_pressure_record_table', category: 'clinical' }); });
  if (has('blood_glucose_record_table')) queryRows(db, `select local_date, avg(level) as value from blood_glucose_record_table group by local_date`, row => addRecord({ date: epochDayToISO(row.local_date), metric: 'glucose_mmol_l', value: row.value, unit: 'mmol/L', source, confidence: 'medium', raw: 'blood_glucose_record_table', category: 'clinical' }));
  if (!has('nutrition_record_table') || tableCount(db, 'nutrition_record_table') === 0) inventory.warnings.push('No nutrition records found. Nutrition conclusions should not be made from this database.');
  if (!has('blood_pressure_record_table') || tableCount(db, 'blood_pressure_record_table') === 0) inventory.warnings.push('No blood pressure time-series found.');
  if (!has('blood_glucose_record_table') || tableCount(db, 'blood_glucose_record_table') === 0) inventory.warnings.push('No blood glucose time-series found.');
}

function queryRows(db, sql, cb) {
  try {
    const result = db.exec(sql)[0];
    if (!result) return;
    const cols = result.columns;
    result.values.forEach(vals => {
      const row = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
      if (row.value == null || Number.isFinite(Number(row.value)) || row.sys != null || row.dia != null) cb(row);
    });
  } catch (err) { console.warn('Query failed', sql, err); }
}

function listTables(db) {
  const result = db.exec("select name from sqlite_master where type='table'")[0];
  return result ? result.values.map(v => v[0]) : [];
}

function tableCount(db, table) {
  try { return db.exec(`select count(*) as c from ${table}`)[0].values[0][0]; } catch { return 0; }
}

function extractTextHealthHints(text, source) {
  const date = todayISO();
  const patterns = [
    { metric: 'resting_hr_bpm', re: /resting\s*(?:heart\s*)?hr[^0-9]{0,12}(\d{2,3})\s*bpm/i },
    { metric: 'hrv_rmssd_ms', re: /hrv[^0-9]{0,12}(\d{1,3}(?:\.\d+)?)\s*ms/i },
    { metric: 'sleep_hours', re: /sleep[^0-9]{0,12}(\d+(?:\.\d+)?)\s*(?:h|hours)/i },
    { metric: 'steps', re: /steps[^0-9]{0,12}(\d{3,6})/i },
    { metric: 'weight_kg', re: /weight[^0-9]{0,12}(\d{2,3}(?:\.\d+)?)\s*kg/i },
    { metric: 'active_zone_minutes', re: /active\s*zone\s*minutes[^0-9]{0,12}(\d{1,4})/i },
  ];
  patterns.forEach(p => {
    const m = text.match(p.re);
    if (m) addRecord({ date, metric: p.metric, value: Number(m[1]), unit: METRIC_DEFS[p.metric].unit, source, confidence: 'low', raw: 'text extraction', category: METRIC_DEFS[p.metric].category });
  });
}

function inferMetric(header) {
  const h = header.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (/steps/.test(h)) return 'steps';
  if (/distance.*km|km$/.test(h)) return 'distance_km';
  if (/active_zone|azm|zone_minutes|moderate.*minute|vigorous.*minute/.test(h)) return 'active_zone_minutes';
  if (/exercise.*min|workout.*min|activity.*min/.test(h)) return 'exercise_minutes';
  if (/sleep.*eff/.test(h)) return 'sleep_efficiency';
  if (/sleep|asleep|duration/.test(h) && !/stage/.test(h)) return 'sleep_hours';
  if (/hrv|rmssd/.test(h)) return 'hrv_rmssd_ms';
  if (/resting.*hr|rhr|resting_heart/.test(h)) return 'resting_hr_bpm';
  if (/resp|breath/.test(h)) return 'respiratory_rate_bpm';
  if (/weight|mass.*kg/.test(h)) return 'weight_kg';
  if (/systolic/.test(h)) return 'systolic_bp';
  if (/diastolic/.test(h)) return 'diastolic_bp';
  if (/glucose/.test(h)) return 'glucose_mmol_l';
  return null;
}

function addRecord(record) {
  if (!record.date || !record.metric || !Number.isFinite(Number(record.value)) && record.metric !== 'pdf_note') return;
  state.records.push({ ...record, value: Number(record.value), id: state.records.length + 1 });
}

function finishInventory(inventory, records) {
  inventory.metrics = [...new Set(records.map(r => r.metric))];
  const dates = records.map(r => r.date).filter(Boolean).sort();
  inventory.dateMin = dates[0] || null;
  inventory.dateMax = dates[dates.length - 1] || null;
  if (!records.length && !inventory.warnings.length) inventory.warnings.push('No structured metrics extracted.');
  if (records.length > 1000 && inventory.confidence !== 'low') inventory.confidence = 'high';
}

function rebuildDaily() {
  state.daily = new Map();
  for (const r of state.records) {
    if (!state.daily.has(r.date)) state.daily.set(r.date, {});
    const day = state.daily.get(r.date);
    if (!day[r.metric]) day[r.metric] = [];
    day[r.metric].push(r);
  }
}

function series(metric) {
  const out = [];
  for (const [date, metrics] of state.daily.entries()) {
    if (!metrics[metric]?.length) continue;
    const vals = metrics[metric].map(r => r.value).filter(Number.isFinite);
    if (!vals.length) continue;
    out.push({ date, value: median(vals), n: vals.length, sources: [...new Set(metrics[metric].map(r => r.source))] });
  }
  return out.sort((a,b) => a.date.localeCompare(b.date));
}

function stats(metric, days = null) {
  let s = series(metric);
  if (days && s.length) {
    const cutoff = addDays(s[s.length - 1].date, -days + 1);
    s = s.filter(d => d.date >= cutoff);
  }
  const vals = s.map(d => d.value).filter(Number.isFinite);
  if (!vals.length) return null;
  return { metric, count: vals.length, avg: mean(vals), median: median(vals), min: Math.min(...vals), max: Math.max(...vals), first: vals[0], last: vals[vals.length - 1], latestDate: s[s.length - 1].date, earliestDate: s[0].date, values: s };
}

function renderAll() {
  renderTopStats(); renderSnapshot(); renderChartOptions(); renderChart(els.chartMetric.value); renderPlainSummary(); renderFileTable(); renderQuality(); renderExperiments();
}

function renderTopStats() {
  els.fileCount.textContent = state.files.length;
  els.recordCount.textContent = state.records.length.toLocaleString();
  const dates = state.records.map(r => r.date).filter(Boolean).sort();
  els.dateRange.textContent = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'No data yet';
}

function renderSnapshot() {
  const preferred = ['steps', 'sleep_hours', 'hrv_rmssd_ms', 'resting_hr_bpm', 'respiratory_rate_bpm', 'weight_kg', 'active_zone_minutes', 'exercise_minutes'];
  const cards = preferred.map(metric => {
    const st = stats(metric, 30) || stats(metric);
    if (!st) return '';
    const def = METRIC_DEFS[metric];
    const recent = stats(metric, 7);
    const delta = recent && st ? recent.avg - st.avg : 0;
    const sign = delta > 0 ? '+' : '';
    return `<div class="card"><h3>${def.label}</h3><div class="value">${format(st.last)} ${def.unit}</div><div class="note">Latest ${st.latestDate}. 30d avg ${format(st.avg)}${def.unit ? ' ' + def.unit : ''}${recent ? `. 7d vs 30d: ${sign}${format(delta)}.` : ''}</div></div>`;
  }).join('');
  els.snapshotCards.innerHTML = cards || '<div class="muted">Upload data to build a snapshot.</div>';
  const sourceCount = new Set(state.records.map(r => r.source)).size;
  els.snapshotConfidence.textContent = sourceCount >= 2 ? 'Multi-source' : sourceCount === 1 ? 'Single-source' : 'No data';
}

function renderChartOptions() {
  const metrics = [...new Set(state.records.map(r => r.metric))].filter(m => m !== 'pdf_note');
  const current = els.chartMetric.value;
  els.chartMetric.innerHTML = metrics.map(m => `<option value="${m}">${METRIC_DEFS[m]?.label || m}</option>`).join('');
  if (metrics.includes(current)) els.chartMetric.value = current;
}

function renderChart(metric) {
  if (!metric) { els.chart.innerHTML = 'Upload data to show trends.'; return; }
  const s = series(metric).slice(-120);
  if (s.length < 2) { els.chart.innerHTML = `<span class="empty">Need at least two ${METRIC_DEFS[metric]?.label || metric} records.</span>`; return; }
  const w = 900, h = 280, pad = 38;
  const vals = s.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const x = i => pad + (i / (s.length - 1)) * (w - pad * 2);
  const y = v => h - pad - ((v - min) / range) * (h - pad * 2);
  const points = s.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const def = METRIC_DEFS[metric] || { label: metric, unit: '' };
  els.chart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${def.label} chart">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#fff" />
    <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="#dbe4df" />
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="#dbe4df" />
    <polyline points="${points}" fill="none" stroke="#2f6f5e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    ${s.map((d,i) => `<circle cx="${x(i)}" cy="${y(d.value)}" r="3" fill="#2f6f5e"><title>${d.date}: ${format(d.value)} ${def.unit}</title></circle>`).join('')}
    <text x="${pad}" y="22" fill="#18231f" font-size="18" font-weight="800">${def.label} (${s[0].date} → ${s[s.length-1].date})</text>
    <text x="${pad}" y="${h-10}" fill="#66736d" font-size="12">${s[0].date}</text>
    <text x="${w-pad-80}" y="${h-10}" fill="#66736d" font-size="12">${s[s.length-1].date}</text>
    <text x="8" y="${pad+4}" fill="#66736d" font-size="12">${format(max)}</text>
    <text x="8" y="${h-pad}" fill="#66736d" font-size="12">${format(min)}</text>
  </svg>`;
}

function renderPlainSummary() {
  els.plainSummary.innerHTML = lensPlain();
}

function renderFileTable() {
  els.fileTable.innerHTML = state.files.map(f => `<tr><td><strong>${escapeHtml(f.name)}</strong><br><span class="muted">${formatBytes(f.size)}</span></td><td>${escapeHtml(f.detectedType)}</td><td>${f.metrics.map(m => METRIC_DEFS[m]?.label || m).join(', ') || '—'}</td><td>${f.dateMin || '—'} → ${f.dateMax || '—'}</td><td>${f.confidence}</td><td>${f.warnings.map(escapeHtml).join('<br>') || '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No files loaded yet.</td></tr>';
}

function renderQuality() {
  const metrics = [...new Set(state.records.map(r => r.metric))];
  const dateStats = coverageStats();
  const gaps = [];
  if (!metrics.includes('systolic_bp')) gaps.push('No blood pressure time-series found.');
  if (!metrics.includes('glucose_mmol_l')) gaps.push('No glucose time-series found.');
  if (!metrics.includes('sleep_efficiency')) gaps.push('No consistent sleep efficiency data unless present in CSV.');
  if (!metrics.includes('active_zone_minutes') && !metrics.includes('exercise_minutes')) gaps.push('No reliable structured exercise load metric yet.');
  if (!hasMetricLike('strength')) gaps.push('No strength training benchmark/proxy yet.');
  if (!hasNutrition()) gaps.push('No nutrition data found, so do not overclaim diet/protein/fibre.');
  const conflicts = findConflicts();
  els.qualityReport.innerHTML = [
    qualityCard('Coverage', dateStats || 'No dated records loaded.'),
    qualityCard('Metrics found', metrics.length ? metrics.map(m => METRIC_DEFS[m]?.label || m).join(', ') : 'None yet.'),
    qualityCard('Source conflicts', conflicts.length ? conflicts.slice(0, 6).join('<br>') : 'No obvious same-day source conflicts detected.'),
    qualityCard('Important gaps', gaps.join('<br>') || 'No major gaps detected from current metrics.'),
    qualityCard('Safe to conclude', safeToConclude(metrics)),
    qualityCard('Do not conclude yet', doNotConclude(metrics)),
  ].join('');
}

function qualityCard(title, body) { return `<div class="card"><h3>${title}</h3><div class="note">${body}</div></div>`; }

function renderLensGrid() {
  els.lensGrid.innerHTML = LENSES.map(l => `<div class="lens-card" data-lens="${l.id}"><h3>${l.name}</h3><p>${l.desc}</p><button class="ghost small" data-run-lens="${l.id}">Run lens</button><div class="lens-output muted">Not run yet.</div></div>`).join('');
  document.querySelectorAll('[data-run-lens]').forEach(btn => btn.addEventListener('click', () => runLens(btn.dataset.runLens)));
}

function runAllLenses() { LENSES.forEach(l => runLens(l.id)); }
function runLens(id) {
  const card = document.querySelector(`[data-lens="${id}"] .lens-output`);
  card.classList.remove('muted');
  card.innerHTML = lensOutput(id);
}

function lensOutput(id) {
  if (!state.records.length) return 'No data loaded yet.';
  const map = { plain: lensPlain, medical: lensMedical, sleep: lensSleep, recovery: lensRecovery, exercise: lensExercise, longevity: lensLongevity, adhd: lensAdhd, family: lensFamily, faith: lensFaith, bluezones: lensBlueZones, blueprint: lensBlueprint, correlation: lensCorrelation, anomaly: lensAnomaly };
  return map[id] ? map[id]() : 'Lens not implemented yet.';
}

function lensPlain() {
  if (!state.records.length) return 'No health data loaded yet.';
  const steps = stats('steps', 30), sleep = stats('sleep_hours', 30), hrv = stats('hrv_rmssd_ms', 30), rhr = stats('resting_hr_bpm', 30), weight = stats('weight_kg', 90);
  const strengths = [];
  const watches = [];
  const unknowns = [];
  if (steps?.avg >= 10000) strengths.push(`Movement volume looks strong: recent average is about ${format(steps.avg)} steps/day.`); else if (steps) watches.push(`Steps average about ${format(steps.avg)}/day; that may be fine, but it is not a high movement signal.`); else unknowns.push('No step data.');
  if (sleep?.avg >= 7 && sleep.avg <= 9) strengths.push(`Sleep quantity is often in the adult target zone: about ${format(sleep.avg)} h/night recently.`); else if (sleep) watches.push(`Sleep average is about ${format(sleep.avg)} h; rhythm and recovery may need attention.`); else unknowns.push('No sleep duration data.');
  if (hrv) strengths.push(`HRV is trackable. Treat ${format(hrv.avg)} ms as your personal trend, not a universal score.`); else unknowns.push('No HRV data.');
  if (rhr) strengths.push(`Resting HR is trackable at about ${format(rhr.avg)} bpm recently.`); else unknowns.push('No resting HR data.');
  if (weight) strengths.push(`Weight trend is available from ${weight.earliestDate} to ${weight.latestDate}.`); else unknowns.push('No weight trend.');
  const gaps = importantGaps();
  return `<h3>Summary</h3><ul><li>${strengths.join('</li><li>') || 'No strong patterns yet.'}</li></ul><h3>Watch</h3><ul><li>${(watches.length ? watches : ['The biggest risk is over-interpreting incomplete consumer data.']).join('</li><li>')}</li></ul><h3>Unknowns</h3><ul><li>${[...unknowns, ...gaps].slice(0,6).join('</li><li>')}</li></ul><h3>Next practical step</h3><p>Pick one small experiment, track it for 2–4 weeks, then re-upload/export the data and compare before/after.</p>`;
}

function lensMedical() {
  const clinical = ['systolic_bp','diastolic_bp','glucose_mmol_l','pdf_note'].filter(m => stats(m));
  return `<p><strong>Boundary:</strong> this app can organise patterns, but it cannot diagnose. Pathology PDFs, ECGs, chest pain, fainting, palpitations, medication decisions and unusual breathlessness belong with a GP or qualified clinician.</p><p>${clinical.length ? `Clinical-style data detected: ${clinical.map(m => METRIC_DEFS[m].label).join(', ')}. Use this to prepare GP questions, not to self-diagnose.` : 'No structured blood pressure, glucose, ECG or pathology values were extracted into the timeline yet.'}</p><p class="warning">Urgent symptoms rule: chest pain, fainting, severe unusual breathlessness, one-sided weakness, or sustained/irregular racing heartbeat should not be managed inside this app.</p>`;
}

function lensSleep() {
  const sleep = stats('sleep_hours', 30) || stats('sleep_hours');
  const eff = stats('sleep_efficiency', 30) || stats('sleep_efficiency');
  if (!sleep && !eff) return 'No sleep metrics found yet.';
  const notes = [];
  if (sleep) notes.push(`Average sleep is ${format(sleep.avg)} h over ${sleep.count} days, latest ${format(sleep.last)} h on ${sleep.latestDate}.`);
  if (eff) notes.push(`Average sleep efficiency is ${format(eff.avg)}%.`);
  const flag = sleep && sleep.avg < 7 ? 'Sleep quantity is a likely bottleneck.' : sleep && sleep.avg > 9.5 ? 'Long sleep may be recovery, illness, schedule drift or measurement duplication; check context.' : 'Sleep quantity looks broadly reasonable if the source is accurate.';
  return `<p>${notes.join(' ')}</p><p><strong>Interpretation:</strong> ${flag}</p><p>Best next data: bedtime, wake time, screen cutoff, caffeine timing, mood/energy and whether nights are disrupted by kids or stress.</p>`;
}

function lensRecovery() {
  const hrv = stats('hrv_rmssd_ms', 30) || stats('hrv_rmssd_ms');
  const rhr = stats('resting_hr_bpm', 30) || stats('resting_hr_bpm');
  const rr = stats('respiratory_rate_bpm', 30) || stats('respiratory_rate_bpm');
  if (!hrv && !rhr && !rr) return 'No recovery markers found yet.';
  const parts = [];
  if (hrv) parts.push(`HRV avg ${format(hrv.avg)} ms; use this as a personal trend, not an absolute grade.`);
  if (rhr) parts.push(`Resting HR avg ${format(rhr.avg)} bpm.`);
  if (rr) parts.push(`Respiratory rate avg ${format(rr.avg)}/min.`);
  return `<p>${parts.join(' ')}</p><p><strong>Watch pattern:</strong> low sleep + lower-than-usual HRV + higher-than-usual resting HR is more meaningful than any one number by itself.</p>`;
}

function lensExercise() {
  const steps = stats('steps', 30) || stats('steps');
  const azm = stats('active_zone_minutes', 30) || stats('active_zone_minutes');
  const ex = stats('exercise_minutes', 30) || stats('exercise_minutes');
  const notes = [];
  if (steps) notes.push(`Steps average ${format(steps.avg)}/day.`);
  if (azm) notes.push(`Active/intensity minutes average ${format(azm.avg)}/day where recorded.`);
  if (ex) notes.push(`Exercise sessions average ${format(ex.avg)} min/day where recorded.`);
  const strengthGap = hasMetricLike('strength') ? 'A strength signal exists.' : 'No reliable strength-training signal is present, which is a major healthspan gap.';
  return `<p>${notes.join(' ') || 'No activity metrics found.'}</p><p><strong>Exercise read:</strong> daily movement and structured training are different. ${strengthGap}</p><p>Best next step: add two simple resistance sessions weekly and track completion, soreness and sleep response.</p>`;
}

function lensLongevity() {
  const steps = stats('steps', 60) || stats('steps');
  const sleep = stats('sleep_hours', 30) || stats('sleep_hours');
  return `<p><strong>Longevity thesis:</strong> the app should look for balance, not just more output.</p><ul><li>Movement: ${steps ? `${format(steps.avg)} steps/day recently.` : 'unknown.'}</li><li>Sleep: ${sleep ? `${format(sleep.avg)} h/night recently.` : 'unknown.'}</li><li>Strength: ${hasMetricLike('strength') ? 'some signal present.' : 'missing / needs manual tracking.'}</li><li>Cardio structure: ${stats('active_zone_minutes') || stats('exercise_minutes') ? 'some structured signal present.' : 'unclear.'}</li></ul><p>High-confidence healthspan improvement usually comes from repeatable sleep, strength, aerobic base and sensible recovery—not from obsessing over every wearable blip.</p>`;
}

function lensAdhd() {
  return `<p>For ADHD/regulation, the useful question is not just “are the numbers good?” but “do these rhythms help you feel more embodied, calm and able to choose well?”</p><p>${stats('steps') ? 'Movement data is present, so you can test whether higher-movement days line up with steadier sleep/recovery.' : 'Movement data is missing.'} ${stats('sleep_hours') ? 'Sleep data is present; bedtime drift and short sleep are worth treating as attention/regulation risks.' : 'Sleep data is missing.'}</p><p>Best next tag to add manually: mood, irritability, focus, screen drift, caffeine, and whether you felt calm in your body.</p>`;
}

function lensFamily() {
  const sleep = stats('sleep_hours', 30); const steps = stats('steps', 30);
  return `<p>This lens asks whether the pattern supports being present at home, not just productive.</p><ul><li>${sleep ? `Sleep average: ${format(sleep.avg)} h.` : 'Sleep unknown.'}</li><li>${steps ? `Movement average: ${format(steps.avg)} steps/day.` : 'Movement unknown.'}</li></ul><p>If output is high but sleep/recovery are low, the practical move is not more discipline; it is a simpler rhythm that protects patience and steadiness.</p>`;
}

function lensFaith() {
  return `<p>Faith lens: treat the body as stewardship, not a project to anxiously perfect.</p><p>The healthiest use of this app is to notice what helps peace, patience, self-control, love and presence become more available in ordinary life. Use the data to serve wisdom, not to become ruled by it.</p>`;
}

function lensBlueZones() {
  const steps = stats('steps', 30); return `<p>Blue Zones-style pattern check:</p><ul><li>Natural movement: ${steps ? `strong signal at ${format(steps.avg)} steps/day.` : 'unknown.'}</li><li>Belonging/social rhythm: not measurable yet unless you add tags like frisbee, church, family walk or friends.</li><li>Downshift: sleep/recovery tags can become the proxy.</li><li>Food: no nutrition data unless imported manually.</li></ul>`;
}

function lensBlueprint() {
  return `<p>Optimisation lens, kept sane:</p><ul><li>Track protein/fibre only if you have actual nutrition data; don’t invent it.</li><li>Add strength completion as a simple yes/no metric.</li><li>Use Zone 2/cardio minutes as a weekly target, not a daily obsession.</li><li>Keep sleep timing and recovery as the main bottleneck checks.</li></ul>`;
}

function lensCorrelation() {
  const pairs = [['steps','sleep_hours'], ['sleep_hours','hrv_rmssd_ms'], ['sleep_hours','resting_hr_bpm'], ['exercise_minutes','hrv_rmssd_ms'], ['active_zone_minutes','sleep_hours']];
  const lines = pairs.map(([a,b]) => corrLine(a,b)).filter(Boolean);
  return lines.length ? `<p class="warning">Correlation is not causation. Use this only to generate experiments.</p><ul><li>${lines.join('</li><li>')}</li></ul>` : 'Not enough overlapping metrics for correlations yet.';
}

function corrLine(a,b) {
  const joined = joinSeries(a,b);
  if (joined.length < 8) return null;
  const r = correlation(joined.map(x => x.a), joined.map(x => x.b));
  return `${METRIC_DEFS[a]?.label || a} vs ${METRIC_DEFS[b]?.label || b}: r=${format(r)} across ${joined.length} overlapping days.`;
}

function lensAnomaly() {
  const metrics = ['steps','sleep_hours','hrv_rmssd_ms','resting_hr_bpm','respiratory_rate_bpm','weight_kg'];
  const out = [];
  metrics.forEach(m => {
    const s = series(m); if (s.length < 10) return;
    const vals = s.map(d => d.value); const avg = mean(vals), sdv = sd(vals);
    s.slice(-30).forEach(d => { if (sdv && Math.abs(d.value - avg) > 2 * sdv) out.push(`${d.date}: ${METRIC_DEFS[m].label} ${format(d.value)} is unusual compared with its own history.`); });
  });
  return out.length ? `<ul><li>${out.slice(-10).join('</li><li>')}</li></ul>` : 'No obvious recent outliers, or not enough history to detect them.';
}

function renderExperiments() {
  if (!state.records.length) { els.experimentsList.innerHTML = '<p class="muted">Upload data to generate experiments.</p>'; return; }
  const exps = [];
  if (!hasMetricLike('strength')) exps.push({ title: 'Two strength sessions for 4 weeks', hypothesis: 'Adding simple resistance work improves healthspan balance without needing more random output.', track: 'Yes/no completion, soreness 1–5, sleep hours, HRV/RHR next morning.', success: '6+ sessions completed and no sustained sleep/recovery worsening.', warning: 'Stop or reduce if pain, dizziness or unusual breathlessness occurs.' });
  const sleep = stats('sleep_hours', 30); if (sleep && sleep.avg < 7.5) exps.push({ title: '10-night earlier sleep experiment', hypothesis: 'A consistent wind-down improves sleep quantity and recovery steadiness.', track: 'Lights-out time, sleep hours, HRV, RHR, morning energy.', success: 'Average sleep rises by 20+ minutes without extra stress.', warning: 'Do not turn bedtime into a source of shame or conflict.' });
  if (stats('exercise_minutes') || stats('active_zone_minutes')) exps.push({ title: 'Post-exercise recovery protocol', hypothesis: 'A predictable cooldown after sport protects sleep and next-day regulation.', track: 'Exercise day, cooldown done, bedtime, sleep, HRV/RHR.', success: 'No repeated next-day recovery dip after exercise nights.', warning: 'Medical symptoms during exercise need clinical advice.' });
  if (!exps.length) exps.push({ title: 'Add three daily context tags', hypothesis: 'Mood, energy and stress tags will explain more than another step graph.', track: 'Morning energy, mood, stress 1–5.', success: 'At least 21 tagged days in a month.', warning: 'Keep it light-touch; no obsessive tracking.' });
  els.experimentsList.innerHTML = exps.map(e => `<div class="experiment"><h3>${e.title}</h3><dl><dt>Hypothesis</dt><dd>${e.hypothesis}</dd><dt>Track</dt><dd>${e.track}</dd><dt>Success</dt><dd>${e.success}</dd><dt>Warning</dt><dd>${e.warning}</dd></dl></div>`).join('');
}

function answerQuestion() {
  const q = els.questionInput.value.trim().toLowerCase();
  if (!q) return;
  if (!state.records.length) { els.answerBox.textContent = 'No data loaded yet.'; return; }
  let answer;
  if (/sleep/.test(q)) answer = lensSleep();
  else if (/hrv|recovery|resting|rhr|nervous/.test(q)) answer = lensRecovery();
  else if (/step|exercise|cardio|training|frisbee|activity/.test(q)) answer = lensExercise();
  else if (/gap|missing|track next|quality/.test(q)) answer = renderTextQuality();
  else if (/change|30|recent/.test(q)) answer = recentChangeAnswer();
  else if (/gp|doctor|pathology|ecg|blood|medical/.test(q)) answer = lensMedical();
  else answer = lensPlain();
  els.answerBox.innerHTML = answer;
}

function recentChangeAnswer() {
  const lines = ['Recent 7-day vs 30-day comparison:'];
  ['steps','sleep_hours','hrv_rmssd_ms','resting_hr_bpm','weight_kg','active_zone_minutes'].forEach(m => {
    const s7 = stats(m, 7), s30 = stats(m, 30); if (!s7 || !s30) return;
    const delta = s7.avg - s30.avg; lines.push(`${METRIC_DEFS[m].label}: 7d avg ${format(s7.avg)} vs 30d avg ${format(s30.avg)} (${delta >= 0 ? '+' : ''}${format(delta)}).`);
  });
  return `<ul><li>${lines.join('</li><li>')}</li></ul>`;
}

function renderTextQuality() { return `<p>${safeToConclude([...new Set(state.records.map(r => r.metric))])}</p><p>${doNotConclude([...new Set(state.records.map(r => r.metric))])}</p>`; }

function exportReport() {
  const md = buildMarkdownReport();
  state.lastReport = md;
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `josh-health-lens-report-${todayISO()}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function buildMarkdownReport() {
  const files = state.files.map(f => `- ${f.name} — ${f.detectedType}; metrics: ${f.metrics.join(', ') || 'none'}; range: ${f.dateMin || '—'} to ${f.dateMax || '—'}; warnings: ${f.warnings.join('; ') || 'none'}`).join('\n');
  return `# Josh Health Lens Report\n\nGenerated: ${new Date().toLocaleString()}\n\n> This is personal health pattern analysis, not medical advice. Discuss medical concerns, symptoms, pathology results, ECG findings, chest pain, fainting, palpitations, abnormal breathlessness, or medication decisions with a GP or qualified clinician.\n\n## Sources\n${files || 'No files loaded.'}\n\n## Plain-English Summary\n${stripHtml(lensPlain())}\n\n## Data Quality\n${stripHtml(renderTextQuality())}\n\n## Sleep Lens\n${stripHtml(lensSleep())}\n\n## Recovery Lens\n${stripHtml(lensRecovery())}\n\n## Exercise Lens\n${stripHtml(lensExercise())}\n\n## Longevity Lens\n${stripHtml(lensLongevity())}\n\n## Experiments\n${document.getElementById('experimentsList').innerText}\n`;
}

function loadSample() {
  const sample = `date,steps,sleep_hours,hrv_rmssd_ms,resting_hr_bpm,respiratory_rate_bpm,weight_kg,exercise_minutes\n2026-05-01,11240,7.8,38,58,12,81.5,20\n2026-05-02,15300,8.1,41,57,12,81.4,0\n2026-05-03,9800,6.9,32,61,13,81.7,35\n2026-05-04,13100,7.4,35,60,12,81.6,0\n2026-05-05,17800,8.2,43,56,12,81.5,55\n2026-05-06,12100,7.6,37,59,12,81.4,0\n2026-05-07,14200,7.9,39,58,12,81.3,30`;
  const inventory = { id: 'sample', name: 'sample_daily_metrics.csv', size: sample.length, detectedType: 'Sample daily health metrics CSV', metrics: [], dateMin: null, dateMax: null, confidence: 'medium', warnings: ['Sample data only; not your real health data.'], createdAt: new Date().toISOString() };
  state.files.push(inventory);
  const rows = parseCSV(sample);
  rows.forEach(row => Object.keys(row).forEach(h => {
    if (h === 'date') return;
    const metric = inferMetric(h); const value = Number(row[h]); if (!metric || !Number.isFinite(value)) return;
    addRecord({ date: row.date, metric, value, unit: METRIC_DEFS[metric]?.unit || '', source: inventory.name, confidence: 'medium', raw: h, category: METRIC_DEFS[metric]?.category || 'unknown' });
  }));
  finishInventory(inventory, state.records.filter(r => r.source === inventory.name));
  rebuildDaily(); persist(); renderAll();
}

async function loadScript(src) { return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(`Could not load ${src}`)); document.head.appendChild(s); }); }
async function loadSqlJs() { if (window.SQL) return; await loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js'); window.SQL = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` }); }
async function loadPdfJs() { if (window.pdfjsLib) return; await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'; }

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}
function splitCSVLine(line) { const out = []; let cur = '', quote = false; for (let i=0; i<line.length; i++) { const c=line[i]; if (c === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (c === '"') quote = !quote; else if (c === ',' && !quote) { out.push(cur); cur=''; } else cur += c; } out.push(cur); return out; }
function pick(headers, candidates) { return headers.find(h => candidates.includes(h.toLowerCase())) || headers.find(h => candidates.some(c => h.toLowerCase().includes(c))); }
function normaliseDate(v) { if (v == null || v === '') return null; if (typeof v === 'number' || /^\d+$/.test(String(v))) { const n = Number(v); if (n > 1000000000000) return new Date(n).toISOString().slice(0,10); if (n > 1000000000) return new Date(n * 1000).toISOString().slice(0,10); if (n > 15000 && n < 30000) return epochDayToISO(n); } const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,10); }
function epochDayToISO(n) { return new Date(Number(n) * 86400000).toISOString().slice(0,10); }
function todayISO() { return new Date().toISOString().slice(0,10); }
function addDays(iso, days) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
function mean(a) { return a.reduce((s,v)=>s+v,0)/a.length; }
function median(a) { const b=[...a].sort((x,y)=>x-y); const mid=Math.floor(b.length/2); return b.length%2 ? b[mid] : (b[mid-1]+b[mid])/2; }
function sd(a) { const m=mean(a); return Math.sqrt(mean(a.map(v => (v-m)**2))); }
function correlation(a,b) { const ma=mean(a), mb=mean(b), sda=sd(a), sdb=sd(b); if (!sda || !sdb) return 0; return mean(a.map((v,i)=>(v-ma)*(b[i]-mb))) / (sda*sdb); }
function joinSeries(a,b) { const sa = new Map(series(a).map(d => [d.date, d.value])); return series(b).filter(d => sa.has(d.date)).map(d => ({ date: d.date, a: sa.get(d.date), b: d.value })); }
function format(n) { if (!Number.isFinite(Number(n))) return '—'; return Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : Number(n).toFixed(1).replace(/\.0$/,''); }
function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024*1024) return `${format(bytes/1024)} KB`; return `${format(bytes/1024/1024)} MB`; }
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function stripHtml(html) { const div=document.createElement('div'); div.innerHTML=html; return div.innerText; }
function coverageStats() { const dates = state.records.map(r => r.date).filter(Boolean).sort(); if (!dates.length) return null; const metrics = [...new Set(state.records.map(r => r.metric))].length; const sources = new Set(state.records.map(r => r.source)).size; return `${dates[0]} to ${dates[dates.length-1]}, ${dates.length.toLocaleString()} dated records, ${metrics} metric types, ${sources} source file(s).`; }
function hasMetricLike(term) { return state.records.some(r => r.metric.includes(term) || r.raw?.toLowerCase().includes(term)); }
function hasNutrition() { return state.records.some(r => /protein|fibre|fiber|calorie|nutrition|energy/.test((r.metric + ' ' + r.raw).toLowerCase())); }
function importantGaps() { const metrics = new Set(state.records.map(r => r.metric)); const gaps=[]; if(!metrics.has('systolic_bp')) gaps.push('No blood pressure time-series.'); if(!metrics.has('glucose_mmol_l')) gaps.push('No glucose time-series.'); if(!hasNutrition()) gaps.push('No nutrition data.'); if(!hasMetricLike('strength')) gaps.push('No strength benchmark/training signal.'); return gaps; }
function safeToConclude(metrics) { const safe=[]; if(metrics.includes('steps')) safe.push('movement volume trends'); if(metrics.includes('sleep_hours')) safe.push('sleep duration trends'); if(metrics.includes('hrv_rmssd_ms') || metrics.includes('resting_hr_bpm')) safe.push('personal recovery trends'); if(metrics.includes('weight_kg')) safe.push('weight trend'); return safe.length ? `Reasonably safe to analyse: ${safe.join(', ')}. Still treat wearables as trend tools, not diagnostic instruments.` : 'Not enough structured data to conclude much yet.'; }
function doNotConclude(metrics) { const no=[]; if(!metrics.includes('systolic_bp')) no.push('blood pressure health'); if(!metrics.includes('glucose_mmol_l')) no.push('glucose control'); if(!hasNutrition()) no.push('diet quality/protein/fibre'); if(!hasMetricLike('strength')) no.push('muscle/strength status'); no.push('diagnosis or medication decisions'); return `Do not conclude yet: ${no.join(', ')}.`; }
function findConflicts() { const out=[]; for (const [date, metrics] of state.daily.entries()) { for (const [m, recs] of Object.entries(metrics)) { const sources = new Set(recs.map(r=>r.source)); if (sources.size < 2 || recs.length < 2 || m === 'pdf_note') continue; const vals = recs.map(r=>r.value); const spread = Math.max(...vals) - Math.min(...vals); const avg = mean(vals); if (avg && spread / Math.abs(avg) > 0.25) out.push(`${date} ${METRIC_DEFS[m]?.label || m}: ${format(Math.min(...vals))}–${format(Math.max(...vals))} across ${sources.size} sources.`); } } return out; }
function persist() { try { localStorage.setItem('jhl-state', JSON.stringify({ files: state.files, records: state.records.slice(-15000) })); } catch (e) { console.warn('Persist failed', e); } }
function restore() { try { const raw=localStorage.getItem('jhl-state'); if(!raw) return; const parsed=JSON.parse(raw); state.files=parsed.files||[]; state.records=parsed.records||[]; rebuildDaily(); } catch { } }
