export interface PreviewAnnotation {
  id: string
  x: number
  y: number
  text: string
  createdAt: string
}

export function createPreviewAnnotation(input: { x: number; y: number }): PreviewAnnotation {
  return {
    id: `annotation-${Date.now()}-${Math.round(input.x * 100)}-${Math.round(input.y * 100)}`,
    x: Math.max(0, Math.min(100, input.x)),
    y: Math.max(0, Math.min(100, input.y)),
    text: '',
    createdAt: new Date().toISOString(),
  }
}

export function buildPreviewAnnotationNotes(annotations: PreviewAnnotation[]) {
  const filled = annotations
    .map((annotation, index) => ({
      ...annotation,
      index: index + 1,
      text: annotation.text.trim(),
    }))
    .filter((annotation) => annotation.text.length > 0)

  if (!filled.length) return ''

  return [
    '## Preview Annotations',
    'The user placed these notes directly on the current rendered output. Treat coordinates as percentages from the top-left of the preview viewport.',
    ...filled.map((annotation) =>
      `Annotation ${annotation.index}: x=${annotation.x.toFixed(1)}%, y=${annotation.y.toFixed(1)}% — ${annotation.text}`,
    ),
  ].join('\n')
}
