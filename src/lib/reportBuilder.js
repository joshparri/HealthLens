export function buildReportJson({ result = '', parsedFiles = [], selectedModes = [], provider = '', model = '' } = {}) {
  return {
    app: 'HealthLens',
    generatedAt: new Date().toISOString(),
    provider,
    model,
    selectedModes,
    medicalBoundary: 'Personal health pattern analysis only. Not medical advice.',
    reportMarkdown: result,
    evidenceFiles: parsedFiles.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size || 0,
      summary: file.summary || '',
    })),
  }
}
