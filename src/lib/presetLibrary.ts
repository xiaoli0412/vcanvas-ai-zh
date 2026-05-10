import type { CustomProviderConfig, ProviderState, VisionSupportMap } from './providers'
import { getProvider, getProviderModelKey, getActiveModelId } from './providers'
import type { Translate } from './i18n'
import {
  DEFAULT_PROMPT_STUDIO_STATE,
  formatPromptStudioSummary,
  normalizePromptStudioState,
  type PromptStudioState,
} from './promptPresets'

export interface ProviderSelectionSnapshot {
  activeProviderId: string
  activeModelId: string
  custom: CustomProviderConfig
}

export interface VisionRoutingSnapshot {
  analyzerState: Omit<ProviderState, 'keys'>
  codeModelVisionEnabled: boolean
}

export interface PromptPresetPayload {
  studio: PromptStudioState
  promptTemplate: string
  providerSelection: ProviderSelectionSnapshot
  visionRouting: VisionRoutingSnapshot
}

export interface PromptPresetRecord {
  id: string
  name: string
  builtIn?: boolean
  payload: PromptPresetPayload
  createdAt: string
  updatedAt: string
}

export interface PromptPresetCardView {
  id: string
  name: string
  builtIn: boolean
  summary: string
  surface: string
  model: string
  promptPreview: string
}

export interface ApplyPromptPresetResult {
  promptStudio: PromptStudioState
  promptDraft: string
  providerState: ProviderState
  visionProviderState: ProviderState
  visionSupportMap: VisionSupportMap
}

export const PROMPT_PRESET_LIBRARY_STORAGE_KEY = 'vcanvas_prompt_presets'

function cloneCustom(custom?: Partial<CustomProviderConfig>): CustomProviderConfig {
  return {
    mode: custom?.mode || 'compatible',
    baseUrl: custom?.baseUrl || '',
    endpoint: custom?.endpoint || '',
    modelId: custom?.modelId || '',
    resourceUrl: custom?.resourceUrl || '',
    deployment: custom?.deployment || '',
    apiVersion: custom?.apiVersion || '2024-10-21',
  }
}

function cloneProviderStateWithoutKeys(state: ProviderState): Omit<ProviderState, 'keys'> {
  return {
    activeProviderId: state.activeProviderId,
    activeModelId: state.activeModelId,
    custom: cloneCustom(state.custom),
  }
}

function readStorage(): PromptPresetRecord[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(PROMPT_PRESET_LIBRARY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizePromptPresetRecord).filter(Boolean) as PromptPresetRecord[]
  } catch {
    return []
  }
}

function writeStorage(records: PromptPresetRecord[]) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PROMPT_PRESET_LIBRARY_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // ignore
  }
}

function normalizePromptPresetRecord(value: any): PromptPresetRecord | null {
  if (!value || typeof value !== 'object') return null
  const studio = normalizePromptStudioState(value.payload?.studio || DEFAULT_PROMPT_STUDIO_STATE)
  const providerSelection: ProviderSelectionSnapshot = {
    activeProviderId: typeof value.payload?.providerSelection?.activeProviderId === 'string' ? value.payload.providerSelection.activeProviderId : 'zai',
    activeModelId: typeof value.payload?.providerSelection?.activeModelId === 'string' ? value.payload.providerSelection.activeModelId : '',
    custom: cloneCustom(value.payload?.providerSelection?.custom),
  }
  const visionRouting: VisionRoutingSnapshot = {
    analyzerState: {
      activeProviderId: typeof value.payload?.visionRouting?.analyzerState?.activeProviderId === 'string'
        ? value.payload.visionRouting.analyzerState.activeProviderId
        : 'google',
      activeModelId: typeof value.payload?.visionRouting?.analyzerState?.activeModelId === 'string'
        ? value.payload.visionRouting.analyzerState.activeModelId
        : '',
      custom: cloneCustom(value.payload?.visionRouting?.analyzerState?.custom),
    },
    codeModelVisionEnabled: typeof value.payload?.visionRouting?.codeModelVisionEnabled === 'boolean'
      ? value.payload.visionRouting.codeModelVisionEnabled
      : true,
  }

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Untitled preset',
    builtIn: Boolean(value.builtIn),
    payload: {
      studio,
      promptTemplate: typeof value.payload?.promptTemplate === 'string' ? value.payload.promptTemplate : '',
      providerSelection,
      visionRouting,
    },
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

function makeBuiltInPreset(
  id: string,
  name: string,
  payload: Partial<PromptPresetPayload>,
): PromptPresetRecord {
  const timestamp = '2026-05-10T00:00:00.000Z'
  return normalizePromptPresetRecord({
    id,
    name,
    builtIn: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    payload: {
      studio: payload.studio,
      promptTemplate: payload.promptTemplate || '',
      providerSelection: payload.providerSelection,
      visionRouting: payload.visionRouting,
    },
  })!
}

export const BUILT_IN_PROMPT_PRESETS: PromptPresetRecord[] = [
  makeBuiltInPreset('builtin-apple-product-ui', 'Apple Product UI', {
    studio: {
      workflowId: 'product-ui',
      styleIds: ['apple', 'linear'],
      surface: 'responsive-web',
      tone: 'calm',
      density: 'balanced',
      motion: 'meaningful',
      fidelity: 'ship-ready',
    },
    promptTemplate: 'Design a premium product interface with clear structure, calm polish, and production-grade component detail.',
    providerSelection: { activeProviderId: 'zai', activeModelId: 'glm-5v-turbo', custom: cloneCustom() },
    visionRouting: { analyzerState: { activeProviderId: 'google', activeModelId: 'gemini-3.1-pro-preview', custom: cloneCustom() }, codeModelVisionEnabled: true },
  }),
  makeBuiltInPreset('builtin-google-material-mobile', 'Google Material Mobile', {
    studio: {
      workflowId: 'mobile-app',
      styleIds: ['google-material'],
      surface: 'mobile-app',
      tone: 'playful',
      density: 'balanced',
      motion: 'meaningful',
      fidelity: 'ship-ready',
    },
    promptTemplate: 'Turn this into a mobile-first experience with strong accessibility, touch-friendly structure, and a modern system feel.',
    providerSelection: { activeProviderId: 'google', activeModelId: 'gemini-3.1-pro-preview', custom: cloneCustom() },
    visionRouting: { analyzerState: { activeProviderId: 'google', activeModelId: 'gemini-3.1-pro-preview', custom: cloneCustom() }, codeModelVisionEnabled: true },
  }),
  makeBuiltInPreset('builtin-microsoft-ops-dashboard', 'Microsoft Ops Dashboard', {
    studio: {
      workflowId: 'dashboard-ops',
      styleIds: ['microsoft-fluent', 'atlassian'],
      surface: 'desktop-app',
      tone: 'enterprise',
      density: 'dense',
      motion: 'minimal',
      fidelity: 'ship-ready',
    },
    promptTemplate: 'Create an operational dashboard with strong data hierarchy, trustworthy status surfaces, and serious team-ready clarity.',
    providerSelection: { activeProviderId: 'openrouter', activeModelId: 'google/gemini-3-flash-preview-20251217', custom: cloneCustom() },
    visionRouting: { analyzerState: { activeProviderId: 'google', activeModelId: 'gemini-3.1-pro-preview', custom: cloneCustom() }, codeModelVisionEnabled: true },
  }),
  makeBuiltInPreset('builtin-stripe-saas-landing', 'Stripe SaaS Landing', {
    studio: {
      workflowId: 'landing-page',
      styleIds: ['stripe', 'vercel'],
      surface: 'responsive-web',
      tone: 'bold',
      density: 'balanced',
      motion: 'expressive',
      fidelity: 'pitch-ready',
    },
    promptTemplate: 'Build a striking SaaS landing page with strong narrative flow, premium typography, and clear conversion momentum.',
    providerSelection: { activeProviderId: 'openrouter', activeModelId: 'anthropic/claude-4.6-sonnet-20260217', custom: cloneCustom() },
    visionRouting: { analyzerState: { activeProviderId: 'google', activeModelId: 'gemini-3.1-pro-preview', custom: cloneCustom() }, codeModelVisionEnabled: true },
  }),
  makeBuiltInPreset('builtin-github-docs-hub', 'GitHub Docs Hub', {
    studio: {
      workflowId: 'docs-knowledge',
      styleIds: ['github', 'notion'],
      surface: 'responsive-web',
      tone: 'editorial',
      density: 'balanced',
      motion: 'minimal',
      fidelity: 'ship-ready',
    },
    promptTemplate: 'Create a documentation hub with excellent reading rhythm, strong navigation, and code-friendly clarity.',
    providerSelection: { activeProviderId: 'zai', activeModelId: 'glm-5v-turbo', custom: cloneCustom() },
    visionRouting: { analyzerState: { activeProviderId: 'google', activeModelId: 'gemini-3.1-pro-preview', custom: cloneCustom() }, codeModelVisionEnabled: true },
  }),
  makeBuiltInPreset('builtin-linear-internal-tool', 'Linear Internal Tool', {
    studio: {
      workflowId: 'internal-tool',
      styleIds: ['linear', 'github'],
      surface: 'desktop-app',
      tone: 'enterprise',
      density: 'dense',
      motion: 'meaningful',
      fidelity: 'ship-ready',
    },
    promptTemplate: 'Design a serious internal tool with sharp hierarchy, keyboard-power-user energy, and zero fluff.',
    providerSelection: { activeProviderId: 'custom', activeModelId: '', custom: cloneCustom({ mode: 'compatible' }) },
    visionRouting: { analyzerState: { activeProviderId: 'google', activeModelId: 'gemini-3.1-pro-preview', custom: cloneCustom() }, codeModelVisionEnabled: false },
  }),
]

export function loadUserPromptPresets() {
  return readStorage().filter((preset) => !preset.builtIn)
}

export function saveUserPromptPresets(records: PromptPresetRecord[]) {
  writeStorage(records.filter((preset) => !preset.builtIn))
}

export function createPromptPresetPayload(
  promptStudio: PromptStudioState,
  promptDraft: string,
  providerState: ProviderState,
  visionProviderState: ProviderState,
  visionSupportMap: VisionSupportMap,
): PromptPresetPayload {
  const activeProvider = getProvider(providerState.activeProviderId)
  const activeModelId = getActiveModelId(providerState)
  const visionEnabled = activeModelId
    ? Boolean(visionSupportMap[getProviderModelKey(activeProvider.id, activeModelId, activeProvider.id === 'custom' ? providerState.custom : undefined)]
      ?? (activeProvider.models.find((model) => model.id === activeModelId)?.vision ?? (activeProvider.type === 'gemini')))
    : true

  return {
    studio: normalizePromptStudioState(promptStudio),
    promptTemplate: promptDraft,
    providerSelection: {
      activeProviderId: providerState.activeProviderId,
      activeModelId: getActiveModelId(providerState),
      custom: cloneCustom(providerState.custom),
    },
    visionRouting: {
      analyzerState: cloneProviderStateWithoutKeys(visionProviderState),
      codeModelVisionEnabled: visionEnabled,
    },
  }
}

export function createUserPromptPreset(name: string, payload: PromptPresetPayload): PromptPresetRecord {
  const timestamp = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    payload: {
      ...payload,
      studio: normalizePromptStudioState(payload.studio),
      providerSelection: {
        ...payload.providerSelection,
        custom: cloneCustom(payload.providerSelection.custom),
      },
      visionRouting: {
        codeModelVisionEnabled: payload.visionRouting.codeModelVisionEnabled,
        analyzerState: {
          ...payload.visionRouting.analyzerState,
          custom: cloneCustom(payload.visionRouting.analyzerState.custom),
        },
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function overwriteUserPromptPreset(record: PromptPresetRecord, payload: PromptPresetPayload): PromptPresetRecord {
  return {
    ...record,
    payload: {
      ...payload,
      studio: normalizePromptStudioState(payload.studio),
      providerSelection: {
        ...payload.providerSelection,
        custom: cloneCustom(payload.providerSelection.custom),
      },
      visionRouting: {
        codeModelVisionEnabled: payload.visionRouting.codeModelVisionEnabled,
        analyzerState: {
          ...payload.visionRouting.analyzerState,
          custom: cloneCustom(payload.visionRouting.analyzerState.custom),
        },
      },
    },
    updatedAt: new Date().toISOString(),
  }
}

export function renameUserPromptPreset(record: PromptPresetRecord, name: string): PromptPresetRecord {
  return {
    ...record,
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  }
}

export function applyPromptPreset(
  preset: PromptPresetRecord,
  currentProviderState: ProviderState,
  currentVisionProviderState: ProviderState,
  currentVisionSupportMap: VisionSupportMap,
): ApplyPromptPresetResult {
  const providerSelection = preset.payload.providerSelection
  const providerState: ProviderState = {
    activeProviderId: providerSelection.activeProviderId,
    activeModelId: providerSelection.activeProviderId === 'custom'
      ? (providerSelection.custom.modelId?.trim() || '')
      : providerSelection.activeModelId,
    keys: { ...currentProviderState.keys },
    custom: cloneCustom(providerSelection.custom),
  }

  const visionProviderState: ProviderState = {
    activeProviderId: preset.payload.visionRouting.analyzerState.activeProviderId,
    activeModelId: preset.payload.visionRouting.analyzerState.activeProviderId === 'custom'
      ? (preset.payload.visionRouting.analyzerState.custom.modelId?.trim() || '')
      : preset.payload.visionRouting.analyzerState.activeModelId,
    keys: { ...currentVisionProviderState.keys },
    custom: cloneCustom(preset.payload.visionRouting.analyzerState.custom),
  }

  const provider = getProvider(providerState.activeProviderId)
  const modelId = getActiveModelId(providerState)
  const key = modelId
    ? getProviderModelKey(provider.id, modelId, provider.id === 'custom' ? providerState.custom : undefined)
    : ''

  const visionSupportMap: VisionSupportMap = {
    ...currentVisionSupportMap,
  }
  if (key) {
    visionSupportMap[key] = preset.payload.visionRouting.codeModelVisionEnabled
  }

  return {
    promptStudio: normalizePromptStudioState(preset.payload.studio),
    promptDraft: preset.payload.promptTemplate,
    providerState,
    visionProviderState,
    visionSupportMap,
  }
}

export function makePromptPresetCardView(preset: PromptPresetRecord, t: Translate): PromptPresetCardView {
  const summary = formatPromptStudioSummary(preset.payload.studio, t)
  const surface = t(`studio.surface.${preset.payload.studio.surface === 'responsive-web'
    ? 'responsiveWeb'
    : preset.payload.studio.surface === 'desktop-app'
      ? 'desktopApp'
      : preset.payload.studio.surface === 'mobile-app'
        ? 'mobileApp'
        : 'presentation'}`)

  const providerLabel = getProvider(preset.payload.providerSelection.activeProviderId).name
  const modelLabel = preset.payload.providerSelection.activeProviderId === 'custom'
    ? (preset.payload.providerSelection.custom.mode === 'azure'
      ? (preset.payload.providerSelection.custom.deployment || preset.payload.providerSelection.custom.modelId || '—')
      : (preset.payload.providerSelection.custom.modelId || '—'))
    : (preset.payload.providerSelection.activeModelId || '—')

  return {
    id: preset.id,
    name: preset.name,
    builtIn: Boolean(preset.builtIn),
    summary,
    surface,
    model: `${providerLabel} / ${modelLabel}`,
    promptPreview: preset.payload.promptTemplate.trim() || '—',
  }
}
