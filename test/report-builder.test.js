import test from 'node:test'
import assert from 'node:assert'
import { buildReportJson } from '../src/lib/reportBuilder.js'

test('buildReportJson creates exportable report metadata and evidence', () => {
  const report = buildReportJson({
    result: '# Health report',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    selectedModes: ['quickSummary'],
    parsedFiles: [{ name: 'data.csv', type: 'csv', size: 123, summary: 'CSV FILE' }],
  })

  assert.equal(report.app, 'HealthLens')
  assert.equal(report.provider, 'groq')
  assert.equal(report.reportMarkdown, '# Health report')
  assert.deepEqual(report.selectedModes, ['quickSummary'])
  assert.equal(report.evidenceFiles[0].name, 'data.csv')
  assert.match(report.medicalBoundary, /Not medical advice/)
})
