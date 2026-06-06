import type {
  WorkflowContext,
  WorkflowTurnReference,
  WebsiteReferenceContext,
  WebEmbedReference,
  PreviewAnnotation,
  VideoReference,
  CanvasModeId,
} from '../../shared/contracts/publicServer'
import type { WorkflowContextPreferences } from './canvasModes'

interface CreateWorkflowContextOptions {
  modeId: CanvasModeId
  prompt: string
  currentCanvasLabels: string[]
  currentOutputHtml?: string
  previousTurn?: WorkflowTurnReference | null
  preferences: WorkflowContextPreferences
  websiteReference?: WebsiteReferenceContext | null
  webEmbeds?: WebEmbedReference[]
  previewAnnotations?: PreviewAnnotation[]
  videoReference?: VideoReference | null
}

function clampText(value: string | undefined, maxLength: number) {
  if (!value) return ''
  const normalized = value.trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}\n...[truncated]`
}

export function createWorkflowContext({
  modeId,
  prompt,
  currentCanvasLabels,
  currentOutputHtml,
  previousTurn,
  preferences,
  websiteReference,
  webEmbeds,
  previewAnnotations,
  videoReference,
}: CreateWorkflowContextOptions): WorkflowContext {
  return {
    modeId,
    prompt,
    carryPolicy: preferences.carryPolicy,
    currentCanvasLabels,
    currentOutputHtml,
    previousTurn: preferences.carryPolicy === 'disabled' ? null : (previousTurn || null),
    includePreviousPrompt: preferences.includePreviousPrompt,
    includePreviousOutput: preferences.includePreviousOutput,
    includePreviousScreenshot: preferences.includePreviousScreenshot,
    websiteReference: websiteReference || null,
    webEmbeds: webEmbeds || [],
    previewAnnotations: previewAnnotations || [],
    videoReference: videoReference || null,
  }
}

export function buildWorkflowContextNotes(context: WorkflowContext) {
  const lines: string[] = []

  lines.push('## Workflow Context')
  lines.push(`Active mode: ${context.modeId}`)

  if (context.currentCanvasLabels.length) {
    lines.push(`Current canvas sources: ${context.currentCanvasLabels.join(', ')}`)
  } else {
    lines.push('Current canvas sources: full canvas')
  }

  if (context.previousTurn && context.carryPolicy !== 'disabled') {
    lines.push(`Carry policy: ${context.carryPolicy}`)

    if (context.includePreviousPrompt) {
      lines.push('Previous turn prompt:')
      lines.push(clampText(context.previousTurn.prompt, 1200))
    }

    if (context.includePreviousOutput && context.previousTurn.html) {
      lines.push('Previous turn HTML:')
      lines.push('```html')
      lines.push(clampText(context.previousTurn.html, 9000))
      lines.push('```')
    }

    if (context.includePreviousScreenshot && context.previousTurn.screenshotDataUrl) {
      lines.push('A previous-turn screenshot is also attached as an image reference.')
    }
  }

  if (context.websiteReference) {
    lines.push('## Website Reference')
    lines.push(`Reference URL: ${context.websiteReference.url}`)
    if (context.websiteReference.styleHints.length) {
      lines.push(`Style hints: ${context.websiteReference.styleHints.join(' | ')}`)
    }
    if (context.websiteReference.html) {
      lines.push('Homepage HTML excerpt:')
      lines.push('```html')
      lines.push(clampText(context.websiteReference.html, 12000))
      lines.push('```')
    }
    if (context.websiteReference.screenshotDataUrl) {
      lines.push('A website reference screenshot is also attached as an image reference.')
    }
  }

  return lines.join('\n')
}

export function createWorkflowTurnReference(input: {
  id: string
  modeId: CanvasModeId
  prompt: string
  html?: string
  screenshotDataUrl?: string | null
}): WorkflowTurnReference {
  return {
    id: input.id,
    modeId: input.modeId,
    prompt: input.prompt,
    html: input.html,
    screenshotDataUrl: input.screenshotDataUrl || null,
    createdAt: new Date().toISOString(),
  }
}
