// Shared types

import type { WorkflowTurnReference } from '../../shared/contracts/publicServer'
import type { WebEmbedReference } from './webEmbeds'

export interface ChatChip {
  role: 'user' | 'assistant'
  text: string
  badge?: string
  images?: { src: string; label: string }[]
}

export function trimChipText(text: string, maxLength = 72) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized
}

export interface ExportedCanvasData {
  elements: unknown
  files?: unknown
  workflowState?: WorkflowTurnReference | null
  webEmbeds?: WebEmbedReference[]
}
