import test from 'node:test'
import assert from 'node:assert'
import { buildDataBlock } from '../src/lib/claudeApi.js'

test('buildDataBlock includes file evidence and stays within provider budget', () => {
  const bigSummary = 'DATA PACK LINE\n'.repeat(8000)
  const block = buildDataBlock([
    {
      name: 'health_connect_export.db',
      type: 'db',
      size: 190_000_000,
      summary: bigSummary,
    },
  ], 'groq')

  assert.match(block, /health_connect_export\.db/)
  assert.match(block, /Truncated by HealthLens/)
  assert.ok(block.length <= 43_000)
})

test('buildDataBlock omits extra files instead of exceeding OpenRouter budget', () => {
  const files = Array.from({ length: 8 }, (_, index) => ({
    name: `file-${index}.pdf`,
    type: 'pdf',
    size: 10_000,
    summary: 'clinical text\n'.repeat(4000),
  }))

  const block = buildDataBlock(files, 'openrouter')

  assert.ok(block.length <= 51_000)
  assert.match(block, /FILE: file-0\.pdf/)
})
