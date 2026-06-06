import type { ContextCarryPolicy, CanvasModeId, WebsiteReferenceContext } from '../../shared/contracts/publicServer'
import {
  DEFAULT_PROMPT_STUDIO_STATE,
  normalizePromptStudioState,
  type PromptStudioState,
} from './promptPresets'

export interface WorkflowContextPreferences {
  carryPolicy: ContextCarryPolicy
  includePreviousPrompt: boolean
  includePreviousOutput: boolean
  includePreviousScreenshot: boolean
}

export interface RemixModeState extends WebsiteReferenceContext {
  fetchStatus: 'idle' | 'loading' | 'ready' | 'error'
}

export interface CanvasModeDefinition {
  id: CanvasModeId
  labelKey: string
  summaryKey: string
  groupKey: string
  badgeKey?: string
  accentToken: string
  manifesto: string
  starterPrompts: string[]
  defaultStudioState: PromptStudioState
  surprisePrompt: string
  placeholderKey: string
  requiresWebsiteReference?: boolean
  resourceHeavy?: boolean
}

export interface ModeSessionState {
  activeModeId: CanvasModeId
  studioByMode: Partial<Record<CanvasModeId, PromptStudioState>>
  promptByMode: Partial<Record<CanvasModeId, string>>
  contextByMode: Partial<Record<CanvasModeId, WorkflowContextPreferences>>
  remixByMode: Partial<Record<CanvasModeId, RemixModeState>>
}

export const VCANVAS_MODE_STATE_STORAGE_KEY = 'vcanvas_mode_state'

const DEFAULT_CONTEXT: WorkflowContextPreferences = {
  carryPolicy: 'last-turn',
  includePreviousPrompt: true,
  includePreviousOutput: true,
  includePreviousScreenshot: true,
}

const DEFAULT_CONTEXT_BY_MODE: Record<CanvasModeId, WorkflowContextPreferences> = {
  custom: { ...DEFAULT_CONTEXT, includePreviousScreenshot: false },
  pure: { ...DEFAULT_CONTEXT, includePreviousScreenshot: false },
  video: { ...DEFAULT_CONTEXT, carryPolicy: 'full' },
  'web-copy': { ...DEFAULT_CONTEXT, carryPolicy: 'full' },
  inspiration: { ...DEFAULT_CONTEXT },
  cinema: { ...DEFAULT_CONTEXT },
  'lite-app': { ...DEFAULT_CONTEXT },
  eclectic: { ...DEFAULT_CONTEXT },
  ppt: { ...DEFAULT_CONTEXT },
  docs: { ...DEFAULT_CONTEXT },
  showcase: { ...DEFAULT_CONTEXT },
  frontier: { ...DEFAULT_CONTEXT, carryPolicy: 'full' },
}

const defaultPresentation = normalizePromptStudioState({
  workflowId: 'landing-page',
  styleIds: ['stripe', 'airbnb'],
  surface: 'presentation',
  tone: 'editorial',
  density: 'airy',
  motion: 'meaningful',
  fidelity: 'pitch-ready',
})

const defaultExperimental = normalizePromptStudioState({
  workflowId: 'experimental-lab',
  styleIds: ['linear', 'vercel', 'stripe'],
  surface: 'presentation',
  tone: 'bold',
  density: 'balanced',
  motion: 'expressive',
  fidelity: 'exploratory',
})

const remixDefaultStudio = normalizePromptStudioState({
  workflowId: 'docs-knowledge',
  styleIds: ['linear', 'vercel'],
  surface: 'responsive-web',
  tone: 'editorial',
  density: 'balanced',
  motion: 'minimal',
  fidelity: 'exploratory',
})

export const CANVAS_MODE_DEFINITIONS: CanvasModeDefinition[] = [
  {
    id: 'custom',
    labelKey: 'mode.custom.label',
    summaryKey: 'mode.custom.summary',
    groupKey: 'mode.group.primary',
    badgeKey: 'mode.badge.default',
    accentToken: 'var(--accent)',
    manifesto: 'This is the primary custom canvas workflow. Stay close to the sketch, preserve intent, and give the user the broadest control.',
    starterPrompts: [
      'Turn this canvas into a polished and faithful implementation.',
      'Use the sketch as the source of truth, then improve hierarchy and finish.',
      'Keep the result dependable, clear, and highly controllable.',
    ],
    defaultStudioState: DEFAULT_PROMPT_STUDIO_STATE,
    surprisePrompt: 'Add one tasteful upgrade that makes the result feel more complete without breaking the original direction.',
    placeholderKey: 'mode.custom.placeholder',
  },
  {
    id: 'pure',
    labelKey: 'mode.pure.label',
    summaryKey: 'mode.pure.summary',
    groupKey: 'mode.group.primary',
    badgeKey: 'mode.badge.original',
    accentToken: 'var(--mode-deepblue)',
    manifesto: 'Recreate the original author’s workflow feel as closely as possible: restrained, dependable, and sketch-led.',
    starterPrompts: [
      'Follow the original inscanvas spirit and keep the output faithful to the sketch.',
      'Use the most grounded interpretation of the reference and avoid over-stylization.',
      'Prioritize clarity, stability, and the original product feel.',
    ],
    defaultStudioState: DEFAULT_PROMPT_STUDIO_STATE,
    surprisePrompt: 'Only make subtle improvements; do not shift the result away from the original product feeling.',
    placeholderKey: 'mode.pure.placeholder',
  },
  {
    id: 'video',
    labelKey: 'mode.video.label',
    summaryKey: 'mode.video.summary',
    groupKey: 'mode.group.reference',
    badgeKey: 'mode.badge.heavy',
    accentToken: 'var(--mode-coral)',
    manifesto: 'Interpret uploaded video references, extract key visual beats, and recreate or refine the result with motion-aware structure.',
    starterPrompts: [
      'Use the imported video reference to reconstruct the key visual frames and interactions.',
      'Focus on motion beats, scene transitions, and the most important keyframe moments.',
      'Treat the video reference as a timeline of visual cues, not just a single still.',
    ],
    defaultStudioState: defaultPresentation,
    surprisePrompt: 'Extract one especially memorable keyframe feeling and amplify it in the final result.',
    placeholderKey: 'mode.video.placeholder',
    resourceHeavy: true,
  },
  {
    id: 'web-copy',
    labelKey: 'mode.webCopy.label',
    summaryKey: 'mode.webCopy.summary',
    groupKey: 'mode.group.reference',
    badgeKey: 'mode.badge.reference',
    accentToken: 'var(--mode-violet)',
    manifesto: 'Study a real webpage, extract layout, pacing, spacing, and styling language, then reconstruct that quality in a new implementation.',
    starterPrompts: [
      'Read the target webpage and reconstruct its spatial language into a new result.',
      'Use the linked homepage as structure and mood reference rather than a pixel-perfect cloning target.',
      'Blend the webpage reference with the canvas to create a fresh but recognizably related result.',
    ],
    defaultStudioState: remixDefaultStudio,
    surprisePrompt: 'Keep the strongest layout rhythm from the referenced site, but reinterpret it with a cleaner and more original twist.',
    placeholderKey: 'mode.webCopy.placeholder',
    requiresWebsiteReference: true,
    resourceHeavy: true,
  },
  {
    id: 'inspiration',
    labelKey: 'mode.inspiration.label',
    summaryKey: 'mode.inspiration.summary',
    groupKey: 'mode.group.creative',
    accentToken: 'var(--mode-amber)',
    manifesto: 'Minimize setup and maximize creative lift. This mode should help the user ideate fast with very little configuration.',
    starterPrompts: [
      'Take this canvas as a spark and propose a fresh creative direction.',
      'Use one sentence and one sketch to launch a more inspired result.',
      'Push toward delight, novelty, and momentum without losing coherence.',
    ],
    defaultStudioState: normalizePromptStudioState({
      workflowId: 'experimental-lab',
      styleIds: ['linear', 'airbnb'],
      surface: 'presentation',
      tone: 'playful',
      density: 'airy',
      motion: 'meaningful',
      fidelity: 'exploratory',
    }),
    surprisePrompt: 'Make a bolder conceptual leap and add a surprising but still usable visual idea.',
    placeholderKey: 'mode.inspiration.placeholder',
  },
  {
    id: 'cinema',
    labelKey: 'mode.cinema.label',
    summaryKey: 'mode.cinema.summary',
    groupKey: 'mode.group.creative',
    accentToken: 'var(--mode-coral)',
    manifesto: 'Chase immersive, cinematic quality with scene composition, pacing, contrast, and emotional visual storytelling.',
    starterPrompts: [
      'Turn the canvas into a cinematic experience with mood, pacing, and stronger composition.',
      'Use contrast, reveal moments, and atmosphere to make the result feel more filmic.',
      'Treat the design like a sequence of scenes rather than a flat UI layout.',
    ],
    defaultStudioState: defaultPresentation,
    surprisePrompt: 'Introduce one scene-like moment with a strong emotional or atmospheric shift.',
    placeholderKey: 'mode.cinema.placeholder',
  },
  {
    id: 'lite-app',
    labelKey: 'mode.liteApp.label',
    summaryKey: 'mode.liteApp.summary',
    groupKey: 'mode.group.product',
    accentToken: 'var(--mode-cyan)',
    manifesto: 'Build lightweight applications for study, life, work, games, sites, and blogs with compact structure and practical interactions.',
    starterPrompts: [
      'Turn this into a lightweight but complete application with real utility.',
      'Favor usable flows, lightweight interactions, and fast comprehension.',
      'Make it feel like a practical small app that could actually be shipped quickly.',
    ],
    defaultStudioState: normalizePromptStudioState({
      workflowId: 'product-ui',
      styleIds: ['linear', 'notion'],
      surface: 'responsive-web',
      tone: 'calm',
      density: 'balanced',
      motion: 'meaningful',
      fidelity: 'ship-ready',
    }),
    surprisePrompt: 'Add one thoughtfully efficient workflow detail that makes the app feel more useful immediately.',
    placeholderKey: 'mode.liteApp.placeholder',
  },
  {
    id: 'eclectic',
    labelKey: 'mode.eclectic.label',
    summaryKey: 'mode.eclectic.summary',
    groupKey: 'mode.group.creative',
    accentToken: 'var(--mode-lime)',
    manifesto: 'Do not stay boxed in by one visual school. Mix influences boldly, but still land on something coherent and memorable.',
    starterPrompts: [
      'Break away from a single visual system and combine influences into a surprising result.',
      'Be more unruly and less predictable while still keeping the output usable.',
      'Favor memorable combinations, unusual layout decisions, and expressive edges.',
    ],
    defaultStudioState: defaultExperimental,
    surprisePrompt: 'Combine two unexpectedly different visual influences and make them feel intentional.',
    placeholderKey: 'mode.eclectic.placeholder',
  },
  {
    id: 'ppt',
    labelKey: 'mode.ppt.label',
    summaryKey: 'mode.ppt.summary',
    groupKey: 'mode.group.product',
    accentToken: 'var(--mode-amber)',
    manifesto: 'Produce HTML-native deck-like work with presentation rhythm, persuasive structure, and slide-grade clarity.',
    starterPrompts: [
      'Turn the canvas into an HTML-first presentation deck with strong slide rhythm.',
      'Think in speaker flow, key message hierarchy, and presentation-friendly composition.',
      'Make the result feel like a high-quality deck, not just a generic webpage.',
    ],
    defaultStudioState: normalizePromptStudioState({
      workflowId: 'landing-page',
      styleIds: ['stripe', 'vercel'],
      surface: 'presentation',
      tone: 'editorial',
      density: 'airy',
      motion: 'meaningful',
      fidelity: 'pitch-ready',
    }),
    surprisePrompt: 'Add one especially strong presenter moment or keynote-like composition beat.',
    placeholderKey: 'mode.ppt.placeholder',
  },
  {
    id: 'docs',
    labelKey: 'mode.docs.label',
    summaryKey: 'mode.docs.summary',
    groupKey: 'mode.group.product',
    accentToken: 'var(--mode-cyan)',
    manifesto: 'Create HTML-native document, table, spreadsheet, report, or PDF-like experiences for work-heavy scenarios.',
    starterPrompts: [
      'Turn the canvas into an HTML-native document or work artifact with strong reading flow.',
      'Favor information architecture, table clarity, and work-ready legibility.',
      'Make the result suitable for documentation, reporting, or structured content sharing.',
    ],
    defaultStudioState: normalizePromptStudioState({
      workflowId: 'docs-knowledge',
      styleIds: ['notion', 'github'],
      surface: 'responsive-web',
      tone: 'editorial',
      density: 'balanced',
      motion: 'minimal',
      fidelity: 'ship-ready',
    }),
    surprisePrompt: 'Add one structure or reading aid that makes the document noticeably easier to use.',
    placeholderKey: 'mode.docs.placeholder',
  },
  {
    id: 'showcase',
    labelKey: 'mode.showcase.label',
    summaryKey: 'mode.showcase.summary',
    groupKey: 'mode.group.product',
    accentToken: 'var(--mode-violet)',
    manifesto: 'Pursue premium display quality, elegant staging, and presentational polish for high-end demos and reveals.',
    starterPrompts: [
      'Turn the canvas into a premium showcase experience with strong staging and presence.',
      'Use display-grade composition, polished motion, and deliberate whitespace to elevate the work.',
      'Favor premium presentation quality while keeping the result clear and intentional.',
    ],
    defaultStudioState: defaultPresentation,
    surprisePrompt: 'Introduce one luxury-grade display moment that heightens perceived quality.',
    placeholderKey: 'mode.showcase.placeholder',
  },
  {
    id: 'frontier',
    labelKey: 'mode.frontier.label',
    summaryKey: 'mode.frontier.summary',
    groupKey: 'mode.group.creative',
    badgeKey: 'mode.badge.experimental',
    accentToken: 'var(--mode-lime)',
    manifesto: 'Explore advanced HTML-era interactions and frontier-feeling ideas: spatial UI, tracking, richer sensors, novel interaction metaphors, and experimental capabilities.',
    starterPrompts: [
      'Use the canvas as the basis for a forward-looking interactive concept with advanced HTML capabilities.',
      'Push toward frontier-feeling interaction, depth, or sensory design while remaining technically believable.',
      'Make the result feel like it belongs to the near future of the web.',
    ],
    defaultStudioState: defaultExperimental,
    surprisePrompt: 'Add one distinctly future-facing interaction or technical flourish that still feels plausible on the web.',
    placeholderKey: 'mode.frontier.placeholder',
  },
]

export const CANVAS_MODE_GROUP_ORDER = [
  'mode.group.primary',
  'mode.group.reference',
  'mode.group.creative',
  'mode.group.product',
] as const

const LEGACY_MODE_ID_MAP: Record<string, CanvasModeId> = {
  'classic-studio': 'custom',
  spark: 'inspiration',
  map: 'docs',
  story: 'cinema',
  wild: 'eclectic',
  remix: 'web-copy',
}

function normalizeModeId(raw: unknown): CanvasModeId {
  if (typeof raw !== 'string') return 'custom'
  const migrated = LEGACY_MODE_ID_MAP[raw] || raw
  return CANVAS_MODE_DEFINITIONS.some((mode) => mode.id === migrated)
    ? migrated as CanvasModeId
    : 'custom'
}

export function getCanvasModeDefinition(modeId: CanvasModeId) {
  return CANVAS_MODE_DEFINITIONS.find((mode) => mode.id === modeId) || CANVAS_MODE_DEFINITIONS[0]
}

export function loadModeSessionState(legacyStudioState: PromptStudioState): ModeSessionState {
  try {
    const raw = localStorage.getItem(VCANVAS_MODE_STATE_STORAGE_KEY)
    if (raw) {
      return normalizeModeSessionState(JSON.parse(raw), legacyStudioState)
    }
  } catch {
    // ignore
  }

  return normalizeModeSessionState({}, legacyStudioState)
}

export function saveModeSessionState(state: ModeSessionState) {
  try {
    localStorage.setItem(VCANVAS_MODE_STATE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function normalizeModeSessionState(
  value: Partial<ModeSessionState> | null | undefined,
  legacyStudioState: PromptStudioState,
): ModeSessionState {
  const studioByMode: Partial<Record<CanvasModeId, PromptStudioState>> = {}
  const promptByMode: Partial<Record<CanvasModeId, string>> = {}
  const contextByMode: Partial<Record<CanvasModeId, WorkflowContextPreferences>> = {}
  const remixByMode: Partial<Record<CanvasModeId, RemixModeState>> = {}

  const rawStudioByMode = (value?.studioByMode || {}) as Record<string, PromptStudioState | undefined>
  const rawPromptByMode = (value?.promptByMode || {}) as Record<string, string | undefined>
  const rawContextByMode = (value?.contextByMode || {}) as Record<string, WorkflowContextPreferences | undefined>
  const rawRemixByMode = (value?.remixByMode || {}) as Record<string, RemixModeState | undefined>

  for (const mode of CANVAS_MODE_DEFINITIONS) {
    const legacySourceStudio =
      mode.id === 'custom' ? rawStudioByMode['classic-studio'] :
      mode.id === 'inspiration' ? rawStudioByMode.spark :
      mode.id === 'docs' ? rawStudioByMode.map :
      mode.id === 'cinema' ? rawStudioByMode.story :
      mode.id === 'eclectic' ? rawStudioByMode.wild :
      mode.id === 'web-copy' ? rawStudioByMode.remix :
      undefined

    const nextStudio =
      rawStudioByMode[mode.id]
      ?? legacySourceStudio
      ?? (mode.id === 'custom' ? legacyStudioState : mode.defaultStudioState)
    studioByMode[mode.id] = normalizePromptStudioState(nextStudio)

    const legacyPrompt =
      mode.id === 'custom' ? rawPromptByMode['classic-studio'] :
      mode.id === 'inspiration' ? rawPromptByMode.spark :
      mode.id === 'docs' ? rawPromptByMode.map :
      mode.id === 'cinema' ? rawPromptByMode.story :
      mode.id === 'eclectic' ? rawPromptByMode.wild :
      mode.id === 'web-copy' ? rawPromptByMode.remix :
      undefined

    const prompt = rawPromptByMode[mode.id] ?? legacyPrompt
    if (typeof prompt === 'string') {
      promptByMode[mode.id] = prompt
    }

    const legacyContext =
      mode.id === 'custom' ? rawContextByMode['classic-studio'] :
      mode.id === 'inspiration' ? rawContextByMode.spark :
      mode.id === 'docs' ? rawContextByMode.map :
      mode.id === 'cinema' ? rawContextByMode.story :
      mode.id === 'eclectic' ? rawContextByMode.wild :
      mode.id === 'web-copy' ? rawContextByMode.remix :
      undefined

    const rawContext = rawContextByMode[mode.id] || legacyContext
    contextByMode[mode.id] = {
      carryPolicy: rawContext?.carryPolicy || DEFAULT_CONTEXT_BY_MODE[mode.id].carryPolicy,
      includePreviousPrompt: rawContext?.includePreviousPrompt ?? DEFAULT_CONTEXT_BY_MODE[mode.id].includePreviousPrompt,
      includePreviousOutput: rawContext?.includePreviousOutput ?? DEFAULT_CONTEXT_BY_MODE[mode.id].includePreviousOutput,
      includePreviousScreenshot: rawContext?.includePreviousScreenshot ?? DEFAULT_CONTEXT_BY_MODE[mode.id].includePreviousScreenshot,
    }

    const legacyRemix =
      mode.id === 'web-copy' ? rawRemixByMode.remix :
      undefined
    const rawRemix = rawRemixByMode[mode.id] || legacyRemix
    if (rawRemix) {
      remixByMode[mode.id] = {
        url: rawRemix.url || '',
        html: rawRemix.html || '',
        rebasedHtml: rawRemix.rebasedHtml || '',
        screenshotDataUrl: rawRemix.screenshotDataUrl || null,
        stylesheetSnippets: Array.isArray(rawRemix.stylesheetSnippets) ? rawRemix.stylesheetSnippets : [],
        styleHints: Array.isArray(rawRemix.styleHints) ? rawRemix.styleHints : [],
        fetchedAt: rawRemix.fetchedAt || '',
        error: rawRemix.error || null,
        fetchStatus: rawRemix.fetchStatus || 'idle',
      }
    }
  }

  return {
    activeModeId: normalizeModeId(value?.activeModeId),
    studioByMode,
    promptByMode,
    contextByMode,
    remixByMode,
  }
}

export function getModeStudioState(state: ModeSessionState, modeId: CanvasModeId) {
  return state.studioByMode[modeId] || getCanvasModeDefinition(modeId).defaultStudioState
}

export function getModePromptDraft(state: ModeSessionState, modeId: CanvasModeId) {
  return state.promptByMode[modeId] || ''
}

export function getModeContextPreferences(state: ModeSessionState, modeId: CanvasModeId) {
  return state.contextByMode[modeId] || DEFAULT_CONTEXT_BY_MODE[modeId]
}

export function getModeRemixState(state: ModeSessionState, modeId: CanvasModeId): RemixModeState | null {
  return state.remixByMode[modeId] || null
}
