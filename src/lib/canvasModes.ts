import type { Translate } from './i18n'
import {
  DEFAULT_PROMPT_STUDIO_STATE,
  PROMPT_STUDIO_STORAGE_KEY,
  normalizePromptStudioState,
  type PromptStudioState,
} from './promptPresets'

export type CanvasModeId = 'classic-studio' | 'spark' | 'map' | 'story' | 'wild' | 'remix'
export type CanvasModeAccentToken = 'teal' | 'amber' | 'cyan' | 'coral' | 'lime' | 'sky'

export interface CanvasModeStarterPrompt {
  labelKey: string
  prompt: string
}

export interface CanvasModeManifesto {
  goal: string
  creativeDirection: string[]
  guardrails: string[]
}

export interface CanvasModeUI {
  generatePlaceholderKey: string
  refinePlaceholderKey: string
  generateActionKey: string
  refineActionKey: string
  surpriseLabelKey: string
  frameHintKey: string
  previewEmptyKey: string
  previewHintKey: string
  fineTuneLabelKey: string
  fineTuneHintKey: string
}

export interface CanvasModeDefinition {
  id: CanvasModeId
  labelKey: string
  summaryKey: string
  accentToken: CanvasModeAccentToken
  defaultStudioState: PromptStudioState
  starterPrompts: CanvasModeStarterPrompt[]
  modeStarter: string
  surprisePrompt: string
  mutationDirectives?: string[]
  manifesto: CanvasModeManifesto
  ui: CanvasModeUI
}

export interface ModeSessionState {
  activeModeId: CanvasModeId
  hasExplicitModeChoice: boolean
  studioByMode: Partial<Record<CanvasModeId, PromptStudioState>>
  urlByMode: Partial<Record<CanvasModeId, string>>
}

interface NormalizeModeSessionOptions {
  existingClassicStudio?: PromptStudioState
  isExistingUser?: boolean
}

export const VCANVAS_MODE_STATE_STORAGE_KEY = 'vcanvas_mode_state'

const MODE_ORDER: CanvasModeId[] = ['classic-studio', 'spark', 'map', 'story', 'wild', 'remix']

export const CANVAS_MODES: Record<CanvasModeId, CanvasModeDefinition> = {
  'classic-studio': {
    id: 'classic-studio',
    labelKey: 'mode.classic.label',
    summaryKey: 'mode.classic.summary',
    accentToken: 'teal',
    defaultStudioState: DEFAULT_PROMPT_STUDIO_STATE,
    starterPrompts: [
      {
        labelKey: 'mode.classic.starter.one',
        prompt: 'Turn this wireframe into a polished product interface with strong hierarchy and realistic content.',
      },
      {
        labelKey: 'mode.classic.starter.two',
        prompt: 'Build a clean landing page from this canvas with a memorable hero and credible detail.',
      },
      {
        labelKey: 'mode.classic.starter.three',
        prompt: 'Create a focused dashboard with decision-ready charts, filters, and operational clarity.',
      },
    ],
    modeStarter: '',
    surprisePrompt: 'Use the current Studio settings and elevate the craft without changing the product intent.',
    manifesto: {
      goal: 'Preserve the original VCanvas workflow: sketch, describe, generate, refine.',
      creativeDirection: [
        'Respect the existing Prompt Studio controls and let them drive the result.',
        'Favor production-ready clarity over dramatic experimentation.',
      ],
      guardrails: [
        'Do not add extra mode personality on top of the current Studio behavior.',
      ],
    },
    ui: {
      generatePlaceholderKey: 'prompt.placeholder.generate',
      refinePlaceholderKey: 'prompt.placeholder.refine',
      generateActionKey: 'prompt.generate',
      refineActionKey: 'prompt.refine',
      surpriseLabelKey: 'mode.classic.surprise',
      frameHintKey: 'mode.classic.frameHint',
      previewEmptyKey: 'preview.empty',
      previewHintKey: 'preview.hint',
      fineTuneLabelKey: 'mode.ui.fineTune',
      fineTuneHintKey: 'mode.ui.fineTuneHint',
    },
  },
  spark: {
    id: 'spark',
    labelKey: 'mode.spark.label',
    summaryKey: 'mode.spark.summary',
    accentToken: 'amber',
    defaultStudioState: {
      workflowId: 'experimental-lab',
      styleIds: ['linear', 'airbnb'],
      surface: 'presentation',
      tone: 'playful',
      density: 'airy',
      motion: 'meaningful',
      fidelity: 'exploratory',
    },
    starterPrompts: [
      {
        labelKey: 'mode.spark.starter.one',
        prompt: 'Turn this canvas into a fresh concept that feels immediate, playful, and ready to surprise someone in the first five seconds.',
      },
      {
        labelKey: 'mode.spark.starter.two',
        prompt: 'Invent a bold interface concept from this sketch with one clear wow moment and surprisingly polished details.',
      },
      {
        labelKey: 'mode.spark.starter.three',
        prompt: 'Use the canvas as a seed and create something unexpected, expressive, and instantly memorable.',
      },
    ],
    modeStarter: 'Start fast. Use minimal prompting friction, seize the strongest idea in the canvas, and turn it into an unexpectedly bold concept.',
    surprisePrompt: 'Create something unexpected, bold, and highly imaginative from this canvas. Surprise me with a fresh visual direction and a strong emotional first impression.',
    manifesto: {
      goal: 'Generate high-velocity creative output with almost no setup.',
      creativeDirection: [
        'Favor instant intrigue, strong focal points, and one memorable twist.',
        'Let the canvas hint at the idea, then amplify it into a more surprising concept.',
        'Use less explanation and more visual conviction.',
      ],
      guardrails: [
        'Keep the result understandable within seconds.',
        'Avoid generic startup gradients or bland card grids.',
      ],
    },
    ui: {
      generatePlaceholderKey: 'mode.spark.placeholder.generate',
      refinePlaceholderKey: 'mode.spark.placeholder.refine',
      generateActionKey: 'mode.spark.cta.generate',
      refineActionKey: 'mode.spark.cta.refine',
      surpriseLabelKey: 'mode.spark.surprise',
      frameHintKey: 'mode.spark.frameHint',
      previewEmptyKey: 'mode.spark.preview.empty',
      previewHintKey: 'mode.spark.preview.hint',
      fineTuneLabelKey: 'mode.ui.fineTune',
      fineTuneHintKey: 'mode.ui.fineTuneHint',
    },
  },
  map: {
    id: 'map',
    labelKey: 'mode.map.label',
    summaryKey: 'mode.map.summary',
    accentToken: 'cyan',
    defaultStudioState: {
      workflowId: 'docs-knowledge',
      styleIds: ['notion', 'atlassian'],
      surface: 'presentation',
      tone: 'editorial',
      density: 'balanced',
      motion: 'minimal',
      fidelity: 'exploratory',
    },
    starterPrompts: [
      {
        labelKey: 'mode.map.starter.one',
        prompt: 'Organize this canvas into a spatial knowledge surface with clear clusters, pathways, and information rhythm.',
      },
      {
        labelKey: 'mode.map.starter.two',
        prompt: 'Turn these sketches and regions into a diagrammatic interface that helps people understand relationships at a glance.',
      },
      {
        labelKey: 'mode.map.starter.three',
        prompt: 'Use the canvas as a thinking map and transform it into a structured, navigable system with hierarchy and flow.',
      },
    ],
    modeStarter: 'Interpret the canvas as a spatial thinking surface. Reveal relationships, clusters, hierarchy, and movement through information.',
    surprisePrompt: 'Reframe the canvas as a spatial map with clearer structure, stronger hierarchy, and a more insightful way to explore the content.',
    manifesto: {
      goal: 'Convert loose spatial thinking into navigable structure.',
      creativeDirection: [
        'Use the positions, groupings, and negative space in the canvas as clues for hierarchy.',
        'Make relationships visible through layout, connectors, nesting, and visual rhythm.',
        'Aim for interfaces that help people think, not just look polished.',
      ],
      guardrails: [
        'Do not flatten everything into uniform cards.',
        'Keep the structure scannable and purposeful.',
      ],
    },
    ui: {
      generatePlaceholderKey: 'mode.map.placeholder.generate',
      refinePlaceholderKey: 'mode.map.placeholder.refine',
      generateActionKey: 'mode.map.cta.generate',
      refineActionKey: 'mode.map.cta.refine',
      surpriseLabelKey: 'mode.map.surprise',
      frameHintKey: 'mode.map.frameHint',
      previewEmptyKey: 'mode.map.preview.empty',
      previewHintKey: 'mode.map.preview.hint',
      fineTuneLabelKey: 'mode.ui.fineTune',
      fineTuneHintKey: 'mode.ui.fineTuneHint',
    },
  },
  story: {
    id: 'story',
    labelKey: 'mode.story.label',
    summaryKey: 'mode.story.summary',
    accentToken: 'coral',
    defaultStudioState: {
      workflowId: 'landing-page',
      styleIds: ['stripe', 'airbnb'],
      surface: 'presentation',
      tone: 'editorial',
      density: 'airy',
      motion: 'meaningful',
      fidelity: 'pitch-ready',
    },
    starterPrompts: [
      {
        labelKey: 'mode.story.starter.one',
        prompt: 'Turn this sketch into a scene-driven experience with a clear emotional build, a strong reveal, and a satisfying finish.',
      },
      {
        labelKey: 'mode.story.starter.two',
        prompt: 'Transform the canvas into a presentation-like story with a deliberate sequence, expressive pacing, and one hero moment.',
      },
      {
        labelKey: 'mode.story.starter.three',
        prompt: 'Use this canvas as the first frame of a richer visual narrative and build the rest of the experience around it.',
      },
    ],
    modeStarter: 'Think like a storyteller. Compose the output as a sequence of beats with mood, pacing, and memorable transitions.',
    surprisePrompt: 'Build a richer narrative arc from this canvas, with stronger emotional pacing, sharper reveals, and a more cinematic composition.',
    manifesto: {
      goal: 'Turn static sketches into emotionally legible visual stories.',
      creativeDirection: [
        'Design in beats: opening, build, reveal, payoff.',
        'Use typography, framing, and motion to create tension and release.',
        'Make the layout feel composed, not merely assembled.',
      ],
      guardrails: [
        'Do not sacrifice clarity for spectacle.',
        'Avoid repetitive section rhythms that flatten the story.',
      ],
    },
    ui: {
      generatePlaceholderKey: 'mode.story.placeholder.generate',
      refinePlaceholderKey: 'mode.story.placeholder.refine',
      generateActionKey: 'mode.story.cta.generate',
      refineActionKey: 'mode.story.cta.refine',
      surpriseLabelKey: 'mode.story.surprise',
      frameHintKey: 'mode.story.frameHint',
      previewEmptyKey: 'mode.story.preview.empty',
      previewHintKey: 'mode.story.preview.hint',
      fineTuneLabelKey: 'mode.ui.fineTune',
      fineTuneHintKey: 'mode.ui.fineTuneHint',
    },
  },
  wild: {
    id: 'wild',
    labelKey: 'mode.wild.label',
    summaryKey: 'mode.wild.summary',
    accentToken: 'lime',
    defaultStudioState: {
      workflowId: 'experimental-lab',
      styleIds: ['stripe', 'vercel', 'linear'],
      surface: 'presentation',
      tone: 'bold',
      density: 'balanced',
      motion: 'expressive',
      fidelity: 'exploratory',
    },
    starterPrompts: [
      {
        labelKey: 'mode.wild.starter.one',
        prompt: 'Mutate this canvas into a vivid experimental interface that still feels coherent enough to use.',
      },
      {
        labelKey: 'mode.wild.starter.two',
        prompt: 'Take the strongest idea in this sketch and push it into a stranger, sharper, more iconic design direction.',
      },
      {
        labelKey: 'mode.wild.starter.three',
        prompt: 'Use this drawing as a launch pad for an audacious concept with unusual composition, richer motion, and strong identity.',
      },
    ],
    modeStarter: 'Push beyond safe defaults. Chase a distinct, high-memory idea while keeping the result coherent enough to navigate.',
    surprisePrompt: 'Push the concept further: mutate the visual language, break one expected layout pattern, and introduce a daring but intentional creative move.',
    mutationDirectives: [
      'Introduce one controlled mutation: break a familiar grid with an asymmetric composition that still preserves clear navigation.',
      'Introduce one controlled mutation: turn a quiet surface into a more theatrical stage using contrast, scale shifts, or framing.',
      'Introduce one controlled mutation: let one interaction or motion moment feel delightfully uncanny while keeping the rest grounded.',
    ],
    manifesto: {
      goal: 'Deliver more memorable, risk-taking output without collapsing into chaos.',
      creativeDirection: [
        'Choose one audacious move and commit to it.',
        'Favor sharper contrast, more unusual framing, and stronger identity markers.',
        'Let the output feel like a concept someone would remember tomorrow.',
      ],
      guardrails: [
        'Keep the experience usable and visually coherent.',
        'Avoid randomness that does not improve the idea.',
      ],
    },
    ui: {
      generatePlaceholderKey: 'mode.wild.placeholder.generate',
      refinePlaceholderKey: 'mode.wild.placeholder.refine',
      generateActionKey: 'mode.wild.cta.generate',
      refineActionKey: 'mode.wild.cta.refine',
      surpriseLabelKey: 'mode.wild.surprise',
      frameHintKey: 'mode.wild.frameHint',
      previewEmptyKey: 'mode.wild.preview.empty',
      previewHintKey: 'mode.wild.preview.hint',
      fineTuneLabelKey: 'mode.ui.fineTune',
      fineTuneHintKey: 'mode.ui.fineTuneHint',
    },
  },
  remix: {
    id: 'remix',
    labelKey: 'mode.remix.label',
    summaryKey: 'mode.remix.summary',
    accentToken: 'sky',
    defaultStudioState: {
      workflowId: 'landing-page',
      styleIds: ['vercel', 'stripe'],
      surface: 'responsive-web',
      tone: 'editorial',
      density: 'balanced',
      motion: 'minimal',
      fidelity: 'exploratory',
    },
    starterPrompts: [
      {
        labelKey: 'mode.remix.starter.one',
        prompt: 'Reconstruct the referenced homepage into a clean, editable static site while preserving its visual rhythm and overall taste.',
      },
      {
        labelKey: 'mode.remix.starter.two',
        prompt: 'Use the referenced homepage as a style source, then rebuild it with cleaner structure, better semantics, and a production-ready finish.',
      },
      {
        labelKey: 'mode.remix.starter.three',
        prompt: 'Extract the mood, spacing, type, and composition from the referenced homepage, then generate an original but clearly inspired remake.',
      },
    ],
    modeStarter: 'Read the referenced homepage like a design system specimen. Extract structure, spacing, typography, motion cues, and composition, then rebuild it into a fresh static implementation.',
    surprisePrompt: 'Push the remake further: keep the source site DNA, but sharpen hierarchy, improve composition, and make the result feel cleaner and more premium.',
    manifesto: {
      goal: 'Turn a referenced homepage into a reconstructable, editable, source-inspired static implementation.',
      creativeDirection: [
        'Preserve layout rhythm, spacing logic, type scale, and visual pacing from the reference homepage.',
        'Abstract brand feel into reusable design language rather than cloning logos or trademarked content.',
        'Use the HTML structure, screenshot, and stylesheet cues together to rebuild a stronger static version.',
      ],
      guardrails: [
        'Do not reproduce logos, trademarks, or brand names verbatim unless the user explicitly asks.',
        'Favor structural fidelity and stylistic interpretation over pixel-perfect copying.',
      ],
    },
    ui: {
      generatePlaceholderKey: 'mode.remix.placeholder.generate',
      refinePlaceholderKey: 'mode.remix.placeholder.refine',
      generateActionKey: 'mode.remix.cta.generate',
      refineActionKey: 'mode.remix.cta.refine',
      surpriseLabelKey: 'mode.remix.surprise',
      frameHintKey: 'mode.remix.frameHint',
      previewEmptyKey: 'mode.remix.preview.empty',
      previewHintKey: 'mode.remix.preview.hint',
      fineTuneLabelKey: 'mode.ui.fineTune',
      fineTuneHintKey: 'mode.ui.fineTuneHint',
    },
  },
}

export const CANVAS_MODE_LIST = MODE_ORDER.map((id) => CANVAS_MODES[id])

function safeReadStorage(key: string) {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWriteStorage(key: string, value: string) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    // ignore storage write failures
  }
}

function isValidModeId(value: unknown): value is CanvasModeId {
  return MODE_ORDER.includes(value as CanvasModeId)
}

function detectExistingPromptStudioUser() {
  return Boolean(safeReadStorage(PROMPT_STUDIO_STORAGE_KEY))
}

export function getDefaultModeId(isExistingUser: boolean) {
  return 'classic-studio'
}

export function getCanvasMode(modeId: CanvasModeId) {
  return CANVAS_MODES[modeId]
}

export function normalizeModeSessionState(
  value: Partial<ModeSessionState> | null | undefined,
  options: NormalizeModeSessionOptions = {},
): ModeSessionState {
  const existingClassicStudio = normalizePromptStudioState(
    options.existingClassicStudio || DEFAULT_PROMPT_STUDIO_STATE,
  )
  const defaultActiveModeId = getDefaultModeId(Boolean(options.isExistingUser))
  const incomingStudioByMode = value?.studioByMode ?? {}

  const studioByMode = MODE_ORDER.reduce<ModeSessionState['studioByMode']>((acc, modeId) => {
    const defaultState = modeId === 'classic-studio'
      ? existingClassicStudio
      : normalizePromptStudioState(CANVAS_MODES[modeId].defaultStudioState)
    acc[modeId] = normalizePromptStudioState(incomingStudioByMode[modeId] || defaultState)
    return acc
  }, {})

  const urlByMode = MODE_ORDER.reduce<ModeSessionState['urlByMode']>((acc, modeId) => {
    const incomingUrl = value?.urlByMode?.[modeId]
    acc[modeId] = typeof incomingUrl === 'string' ? incomingUrl : ''
    return acc
  }, {})

  studioByMode['classic-studio'] = normalizePromptStudioState(
    incomingStudioByMode['classic-studio'] || existingClassicStudio,
  )

  return {
    activeModeId: isValidModeId(value?.activeModeId) ? value.activeModeId : defaultActiveModeId,
    hasExplicitModeChoice: Boolean(value?.hasExplicitModeChoice),
    studioByMode,
    urlByMode,
  }
}

export function loadModeSessionState(options: NormalizeModeSessionOptions = {}) {
  const raw = safeReadStorage(VCANVAS_MODE_STATE_STORAGE_KEY)
  const isExistingUser = options.isExistingUser ?? detectExistingPromptStudioUser()

  if (!raw) {
    return normalizeModeSessionState(undefined, {
      ...options,
      isExistingUser,
    })
  }

  try {
    const parsed = JSON.parse(raw)
    if (parsed?.activeModeId === 'spark' && !parsed?.hasExplicitModeChoice) {
      parsed.activeModeId = 'classic-studio'
    }

    return normalizeModeSessionState(parsed, {
      ...options,
      isExistingUser,
    })
  } catch {
    return normalizeModeSessionState(undefined, {
      ...options,
      isExistingUser,
    })
  }
}

export function saveModeSessionState(state: ModeSessionState) {
  safeWriteStorage(
    VCANVAS_MODE_STATE_STORAGE_KEY,
    JSON.stringify(normalizeModeSessionState(state, {
      existingClassicStudio: state.studioByMode['classic-studio'],
      isExistingUser: true,
    })),
  )
}

export function getModePromptStudioState(session: ModeSessionState, modeId: CanvasModeId) {
  return normalizePromptStudioState(
    session.studioByMode[modeId] || CANVAS_MODES[modeId].defaultStudioState,
  )
}

export function mergeModeSessionStudioState(
  session: ModeSessionState,
  modeId: CanvasModeId,
  nextStudio: PromptStudioState,
) {
  return normalizeModeSessionState({
    ...session,
    studioByMode: {
      ...session.studioByMode,
      [modeId]: normalizePromptStudioState(nextStudio),
    },
  }, {
    existingClassicStudio: getModePromptStudioState(session, 'classic-studio'),
    isExistingUser: true,
  })
}

export function getModeUrlDraft(session: ModeSessionState, modeId: CanvasModeId) {
  return session.urlByMode[modeId] || ''
}

export function mergeModeSessionUrlDraft(
  session: ModeSessionState,
  modeId: CanvasModeId,
  nextUrl: string,
) {
  return normalizeModeSessionState({
    ...session,
    urlByMode: {
      ...session.urlByMode,
      [modeId]: nextUrl,
    },
  }, {
    existingClassicStudio: getModePromptStudioState(session, 'classic-studio'),
    isExistingUser: true,
  })
}

export function setActiveCanvasMode(session: ModeSessionState, modeId: CanvasModeId) {
  return {
    ...session,
    activeModeId: modeId,
    hasExplicitModeChoice: true,
  }
}

export function getModeMutationDirective(mode: CanvasModeDefinition, seed = '') {
  const directives = mode.mutationDirectives || []
  if (directives.length === 0) return ''

  const seedValue = seed
    .split('')
    .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0)

  return directives[seedValue % directives.length]
}

export function applySurprisePrompt(currentPrompt: string, mode: CanvasModeDefinition) {
  const trimmed = currentPrompt.trim()
  if (!trimmed) return mode.surprisePrompt
  return `${trimmed}\n\nPush the concept further: ${mode.surprisePrompt}`
}

export function formatCanvasModeSummary(mode: CanvasModeDefinition, t: Translate) {
  return t(mode.summaryKey)
}
