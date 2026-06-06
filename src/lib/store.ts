// Shared types

import type { WorkflowTurnReference } from '../../shared/contracts/publicServer'
import type { WebEmbedReference } from './webEmbeds'

export interface ChatChip {
  role: 'user' | 'assistant'
  text: string
  images?: { src: string; label: string }[]
}

export interface ExportedCanvasData {
  elements: unknown
  files?: unknown
  workflowState?: WorkflowTurnReference | null
  webEmbeds?: WebEmbedReference[]
}
