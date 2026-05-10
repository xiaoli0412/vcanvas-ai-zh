import type { Translate } from './i18n'

export type WorkflowPresetId =
  | 'product-ui'
  | 'landing-page'
  | 'dashboard-ops'
  | 'mobile-app'
  | 'internal-tool'
  | 'docs-knowledge'
  | 'commerce-flow'
  | 'experimental-lab'

export type BrandStyleId =
  | 'apple'
  | 'google-material'
  | 'microsoft-fluent'
  | 'stripe'
  | 'shopify'
  | 'github'
  | 'linear'
  | 'notion'
  | 'atlassian'
  | 'airbnb'
  | 'vercel'

export type SurfaceId = 'responsive-web' | 'desktop-app' | 'mobile-app' | 'presentation'
export type ToneId = 'calm' | 'bold' | 'playful' | 'enterprise' | 'editorial'
export type DensityId = 'airy' | 'balanced' | 'dense'
export type MotionId = 'minimal' | 'meaningful' | 'expressive'
export type FidelityId = 'ship-ready' | 'pitch-ready' | 'exploratory'

export interface WorkflowPreset {
  id: WorkflowPresetId
  labelKey: string
  descriptionKey: string
  starterPrompt: string
  directive: string
}

export interface BrandStylePreset {
  id: BrandStyleId
  labelKey: string
  directive: string
}

export interface StudioOption<T extends string> {
  id: T
  labelKey: string
  directive: string
}

export interface PromptStudioState {
  workflowId: WorkflowPresetId
  styleIds: BrandStyleId[]
  surface: SurfaceId
  tone: ToneId
  density: DensityId
  motion: MotionId
  fidelity: FidelityId
}

export const PROMPT_STUDIO_STORAGE_KEY = 'vcanvas_prompt_studio'
export const MAX_STYLE_PRESETS = 3

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'product-ui',
    labelKey: 'studio.workflow.productUi.label',
    descriptionKey: 'studio.workflow.productUi.desc',
    starterPrompt: 'Turn this into a polished product interface with strong task flow, realistic content, and production-ready interaction details.',
    directive: 'Prioritize task clarity, strong hierarchy, believable product thinking, and components that feel ready to ship.',
  },
  {
    id: 'landing-page',
    labelKey: 'studio.workflow.landingPage.label',
    descriptionKey: 'studio.workflow.landingPage.desc',
    starterPrompt: 'Build a conversion-focused landing page with a clear story arc, memorable hero, proof sections, and strong call-to-action rhythm.',
    directive: 'Optimize for narrative flow, differentiation, conversion, and polished marketing composition.',
  },
  {
    id: 'dashboard-ops',
    labelKey: 'studio.workflow.dashboardOps.label',
    descriptionKey: 'studio.workflow.dashboardOps.desc',
    starterPrompt: 'Create an operational dashboard with decision-ready charts, healthy information density, and clear drill-down structure.',
    directive: 'Make dense information scannable, useful, and trustworthy without feeling flat or generic.',
  },
  {
    id: 'mobile-app',
    labelKey: 'studio.workflow.mobileApp.label',
    descriptionKey: 'studio.workflow.mobileApp.desc',
    starterPrompt: 'Design a mobile-first app experience with touch-friendly interaction, clear flows, and polished phone-native presentation.',
    directive: 'Think in mobile-native navigation, thumb reach, concise hierarchy, and compact but elegant detail.',
  },
  {
    id: 'internal-tool',
    labelKey: 'studio.workflow.internalTool.label',
    descriptionKey: 'studio.workflow.internalTool.desc',
    starterPrompt: 'Create a practical internal tool for work: fast to scan, robust in structure, and credible for real teams to use daily.',
    directive: 'Favor clarity, utility, operational confidence, and workflow efficiency over decoration.',
  },
  {
    id: 'docs-knowledge',
    labelKey: 'studio.workflow.docsKnowledge.label',
    descriptionKey: 'studio.workflow.docsKnowledge.desc',
    starterPrompt: 'Build a documentation or knowledge interface with excellent reading rhythm, navigation depth, and component examples where relevant.',
    directive: 'Optimize for long-form readability, information architecture, searchability, and calm utility.',
  },
  {
    id: 'commerce-flow',
    labelKey: 'studio.workflow.commerceFlow.label',
    descriptionKey: 'studio.workflow.commerceFlow.desc',
    starterPrompt: 'Create an e-commerce or transactional flow with persuasive merchandising, trust cues, and a friction-light path to action.',
    directive: 'Balance conversion, trust, product storytelling, and clear transactional affordances.',
  },
  {
    id: 'experimental-lab',
    labelKey: 'studio.workflow.experimentalLab.label',
    descriptionKey: 'studio.workflow.experimentalLab.desc',
    starterPrompt: 'Turn this into a memorable interactive concept with a surprising visual idea, but keep the output coherent and usable.',
    directive: 'Push for originality, delight, and visual signature while preserving a clear user experience.',
  },
]

export const BRAND_STYLE_PRESETS: BrandStylePreset[] = [
  {
    id: 'apple',
    labelKey: 'studio.style.apple.label',
    directive: 'Use restrained premium minimalism, generous negative space, calm hierarchy, soft depth, and meticulous alignment. Do not reproduce Apple logos or proprietary assets.',
  },
  {
    id: 'google-material',
    labelKey: 'studio.style.googleMaterial.label',
    directive: 'Use Material-like clarity, confident color tokens, approachable component logic, and accessible hierarchy with strong system thinking.',
  },
  {
    id: 'microsoft-fluent',
    labelKey: 'studio.style.microsoftFluent.label',
    directive: 'Use layered depth, productivity-minded structure, roomy spacing, restrained translucency, and enterprise-friendly clarity.',
  },
  {
    id: 'stripe',
    labelKey: 'studio.style.stripe.label',
    directive: 'Use editorial fintech polish, modular storytelling, premium typography, gradient restraint, and developer-business credibility.',
  },
  {
    id: 'shopify',
    labelKey: 'studio.style.shopify.label',
    directive: 'Use merchant-friendly warmth, practical onboarding patterns, approachable commerce surfaces, and clear primary action hierarchy.',
  },
  {
    id: 'github',
    labelKey: 'studio.style.github.label',
    directive: 'Use functional developer-first density, documentation-grade clarity, understated color, and robust information organization.',
  },
  {
    id: 'linear',
    labelKey: 'studio.style.linear.label',
    directive: 'Use sharp product minimalism, precise motion, high signal-to-noise, and a polished power-user feel.',
  },
  {
    id: 'notion',
    labelKey: 'studio.style.notion.label',
    directive: 'Use calm editorial rhythm, paper-like spaciousness, modular blocks, and writing-centric utility.',
  },
  {
    id: 'atlassian',
    labelKey: 'studio.style.atlassian.label',
    directive: 'Use scalable navigation, team-workflow structure, pragmatic enterprise clarity, and collaborative information architecture.',
  },
  {
    id: 'airbnb',
    labelKey: 'studio.style.airbnb.label',
    directive: 'Use hospitality warmth, trust-building layout rhythm, friendly rounded surfaces, and polished social proof storytelling.',
  },
  {
    id: 'vercel',
    labelKey: 'studio.style.vercel.label',
    directive: 'Use disciplined monochrome, technical elegance, premium whitespace, and performance-minded developer branding.',
  },
]

export const SURFACE_OPTIONS: StudioOption<SurfaceId>[] = [
  {
    id: 'responsive-web',
    labelKey: 'studio.surface.responsiveWeb',
    directive: 'Build as a responsive web experience that works cleanly from mobile to desktop.',
  },
  {
    id: 'desktop-app',
    labelKey: 'studio.surface.desktopApp',
    directive: 'Treat the output as a desktop product window with mature productivity affordances and desktop-friendly density.',
  },
  {
    id: 'mobile-app',
    labelKey: 'studio.surface.mobileApp',
    directive: 'Treat the output as a phone app mockup with mobile-native patterns, touch-friendly density, and device-aware presentation.',
  },
  {
    id: 'presentation',
    labelKey: 'studio.surface.presentation',
    directive: 'Treat the output as a polished concept surface optimized for visual storytelling and presentation impact.',
  },
]

export const TONE_OPTIONS: StudioOption<ToneId>[] = [
  { id: 'calm', labelKey: 'studio.tone.calm', directive: 'Keep the tone composed, elegant, and quiet.' },
  { id: 'bold', labelKey: 'studio.tone.bold', directive: 'Use higher contrast, stronger hierarchy, and more dramatic focal moments.' },
  { id: 'playful', labelKey: 'studio.tone.playful', directive: 'Introduce warmth, delight, and a little surprise without losing usability.' },
  { id: 'enterprise', labelKey: 'studio.tone.enterprise', directive: 'Favor trust, clarity, consistency, and stakeholder-ready restraint.' },
  { id: 'editorial', labelKey: 'studio.tone.editorial', directive: 'Lean into typography, rhythm, narrative composition, and content presence.' },
]

export const DENSITY_OPTIONS: StudioOption<DensityId>[] = [
  { id: 'airy', labelKey: 'studio.density.airy', directive: 'Use generous whitespace and fewer competing elements.' },
  { id: 'balanced', labelKey: 'studio.density.balanced', directive: 'Balance whitespace with information richness.' },
  { id: 'dense', labelKey: 'studio.density.dense', directive: 'Pack in useful detail while preserving scanability.' },
]

export const MOTION_OPTIONS: StudioOption<MotionId>[] = [
  { id: 'minimal', labelKey: 'studio.motion.minimal', directive: 'Use motion sparingly and only when it improves understanding.' },
  { id: 'meaningful', labelKey: 'studio.motion.meaningful', directive: 'Use transitions and reveals to reinforce hierarchy and feedback.' },
  { id: 'expressive', labelKey: 'studio.motion.expressive', directive: 'Use bolder animation moments, but keep them intentional and performant.' },
]

export const FIDELITY_OPTIONS: StudioOption<FidelityId>[] = [
  { id: 'ship-ready', labelKey: 'studio.fidelity.shipReady', directive: 'Bias toward practical implementation, realistic content, sensible components, and production readiness.' },
  { id: 'pitch-ready', labelKey: 'studio.fidelity.pitchReady', directive: 'Bias toward stronger visual drama and stakeholder persuasion while remaining believable.' },
  { id: 'exploratory', labelKey: 'studio.fidelity.exploratory', directive: 'Bias toward fresh concepts, experimentation, and unexpected layout ideas.' },
]

export const DEFAULT_PROMPT_STUDIO_STATE: PromptStudioState = {
  workflowId: 'product-ui',
  styleIds: ['apple'],
  surface: 'responsive-web',
  tone: 'calm',
  density: 'balanced',
  motion: 'meaningful',
  fidelity: 'ship-ready',
}

function safeReadStorage() {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(PROMPT_STUDIO_STORAGE_KEY)
  } catch {
    return null
  }
}

function safeWriteStorage(value: string) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PROMPT_STUDIO_STORAGE_KEY, value)
  } catch {
    // ignore
  }
}

function isValidWorkflow(value: unknown): value is WorkflowPresetId {
  return WORKFLOW_PRESETS.some((preset) => preset.id === value)
}

function isValidStyle(value: unknown): value is BrandStyleId {
  return BRAND_STYLE_PRESETS.some((preset) => preset.id === value)
}

function isValidSurface(value: unknown): value is SurfaceId {
  return SURFACE_OPTIONS.some((option) => option.id === value)
}

function isValidTone(value: unknown): value is ToneId {
  return TONE_OPTIONS.some((option) => option.id === value)
}

function isValidDensity(value: unknown): value is DensityId {
  return DENSITY_OPTIONS.some((option) => option.id === value)
}

function isValidMotion(value: unknown): value is MotionId {
  return MOTION_OPTIONS.some((option) => option.id === value)
}

function isValidFidelity(value: unknown): value is FidelityId {
  return FIDELITY_OPTIONS.some((option) => option.id === value)
}

export function normalizePromptStudioState(value: Partial<PromptStudioState> | null | undefined): PromptStudioState {
  const styleIds = Array.isArray(value?.styleIds)
    ? value.styleIds.filter(isValidStyle).slice(0, MAX_STYLE_PRESETS)
    : DEFAULT_PROMPT_STUDIO_STATE.styleIds

  return {
    workflowId: isValidWorkflow(value?.workflowId) ? value!.workflowId : DEFAULT_PROMPT_STUDIO_STATE.workflowId,
    styleIds: styleIds.length ? styleIds : DEFAULT_PROMPT_STUDIO_STATE.styleIds,
    surface: isValidSurface(value?.surface) ? value!.surface : DEFAULT_PROMPT_STUDIO_STATE.surface,
    tone: isValidTone(value?.tone) ? value!.tone : DEFAULT_PROMPT_STUDIO_STATE.tone,
    density: isValidDensity(value?.density) ? value!.density : DEFAULT_PROMPT_STUDIO_STATE.density,
    motion: isValidMotion(value?.motion) ? value!.motion : DEFAULT_PROMPT_STUDIO_STATE.motion,
    fidelity: isValidFidelity(value?.fidelity) ? value!.fidelity : DEFAULT_PROMPT_STUDIO_STATE.fidelity,
  }
}

export function loadPromptStudioState(): PromptStudioState {
  const raw = safeReadStorage()
  if (!raw) return DEFAULT_PROMPT_STUDIO_STATE

  try {
    return normalizePromptStudioState(JSON.parse(raw))
  } catch {
    return DEFAULT_PROMPT_STUDIO_STATE
  }
}

export function savePromptStudioState(state: PromptStudioState) {
  safeWriteStorage(JSON.stringify(normalizePromptStudioState(state)))
}

export function getWorkflowPreset(id: WorkflowPresetId) {
  return WORKFLOW_PRESETS.find((preset) => preset.id === id) || WORKFLOW_PRESETS[0]
}

export function getBrandStylePreset(id: BrandStyleId) {
  return BRAND_STYLE_PRESETS.find((preset) => preset.id === id) || BRAND_STYLE_PRESETS[0]
}

export function getStudioOption<T extends string>(options: StudioOption<T>[], id: T) {
  return options.find((option) => option.id === id) || options[0]
}

export function formatPromptStudioSummary(state: PromptStudioState, t: Translate) {
  const workflow = getWorkflowPreset(state.workflowId)
  const styles = state.styleIds.map((id) => t(getBrandStylePreset(id).labelKey)).join(' + ')
  return [t(workflow.labelKey), styles].filter(Boolean).join(' · ')
}
