import {
  DENSITY_OPTIONS,
  FIDELITY_OPTIONS,
  MOTION_OPTIONS,
  SURFACE_OPTIONS,
  TONE_OPTIONS,
  getBrandStylePreset,
  getStudioOption,
  getWorkflowPreset,
  type PromptStudioState,
} from './promptPresets'
import { getModeMutationDirective, type CanvasModeDefinition } from './canvasModes'
import type { WebsiteReferenceContext } from './websiteReference'

function joinBullets(lines: string[]) {
  return lines.map((line) => `- ${line}`).join('\n')
}

function isClassicMode(mode?: CanvasModeDefinition | null) {
  return !mode || mode.id === 'classic-studio'
}

function buildWebsiteReferenceSection(reference?: WebsiteReferenceContext | null) {
  if (!reference) return ''

  const htmlExcerpt = reference.html.slice(0, 6000)
  const sections = [
    '## Website Reference',
    `Reference URL: ${reference.url}`,
    `Fetched at: ${reference.fetchedAt}`,
    'Style hints:',
    joinBullets(reference.styleHints),
  ]

  if (reference.stylesheetSnippets.length > 0) {
    sections.push('Stylesheet snippets:')
    sections.push(joinBullets(reference.stylesheetSnippets.map((snippet) => snippet.slice(0, 600))))
  }

  sections.push('Homepage HTML excerpt:')
  sections.push('```html')
  sections.push(htmlExcerpt)
  sections.push('```')

  return sections.join('\n')
}

function buildModeManifesto(mode: CanvasModeDefinition, seed = '', reference?: WebsiteReferenceContext | null) {
  const mutation = getModeMutationDirective(mode, seed)
  const sections = [
    '## Mode Manifesto',
    `Mode goal: ${mode.manifesto.goal}`,
    'Creative Direction:',
    joinBullets(mode.manifesto.creativeDirection),
    'Mode guardrails:',
    joinBullets(mode.manifesto.guardrails),
  ]

  if (mutation) {
    sections.push('Mode mutation:')
    sections.push(`- ${mutation}`)
  }

  if (reference) {
    sections.push('Mode source reference:')
    sections.push(`- Reconstruct from the referenced homepage without copying logos, trademarks, or brand names verbatim.`)
    sections.push(`- Preserve structural rhythm, spacing logic, hierarchy, and visual language from the reference site.`)
  }

  return sections.join('\n')
}

export function buildSystemPrompt(
  basePrompt: string,
  studio: PromptStudioState,
  mode?: CanvasModeDefinition,
  websiteReference?: WebsiteReferenceContext | null,
) {
  const workflow = getWorkflowPreset(studio.workflowId)
  const styles = studio.styleIds.map(getBrandStylePreset)
  const surface = getStudioOption(SURFACE_OPTIONS, studio.surface)
  const tone = getStudioOption(TONE_OPTIONS, studio.tone)
  const density = getStudioOption(DENSITY_OPTIONS, studio.density)
  const motion = getStudioOption(MOTION_OPTIONS, studio.motion)
  const fidelity = getStudioOption(FIDELITY_OPTIONS, studio.fidelity)

  const sections = [
    basePrompt,
    '',
    ...(!isClassicMode(mode) ? [buildModeManifesto(mode!, workflow.id, websiteReference), ''] : []),
    ...(websiteReference ? [buildWebsiteReferenceSection(websiteReference), ''] : []),
    '## Studio Directives',
    `Workflow focus: ${workflow.directive}`,
    `Surface target: ${surface.directive}`,
    `Tone target: ${tone.directive}`,
    `Density target: ${density.directive}`,
    `Motion target: ${motion.directive}`,
    `Fidelity target: ${fidelity.directive}`,
    '',
    '## Style Presets',
    joinBullets(styles.map((style) => style.directive)),
    '',
    '## Guardrails',
    joinBullets([
      'Use the selected style presets as inspiration for layout, hierarchy, motion, and polish. Do not reproduce logos, trademarks, or proprietary brand assets.',
      'Blend multiple style presets into a coherent design language instead of creating a collage of mismatched pieces.',
      'Keep the result usable for real work. Distinctive is good; confusing is not.',
    ]),
  ]

  return sections.join('\n')
}

function buildModeStarter(mode: CanvasModeDefinition, seed: string, reference?: WebsiteReferenceContext | null) {
  const sections = [
    'Mode starter:',
    mode.modeStarter,
  ]

  const mutation = getModeMutationDirective(mode, seed)
  if (mutation) {
    sections.push(`Mode mutation: ${mutation}`)
  }

  if (reference) {
    sections.push(`Reference URL: ${reference.url}`)
    sections.push(`Reference cues: ${reference.styleHints.join(' | ')}`)
  }

  return sections.join('\n')
}

export function buildGeneratePrompt(
  userPrompt: string,
  studio: PromptStudioState,
  mode?: CanvasModeDefinition,
  websiteReference?: WebsiteReferenceContext | null,
) {
  const workflow = getWorkflowPreset(studio.workflowId)
  const actualPrompt = userPrompt.trim() || (
    websiteReference
      ? 'Reconstruct a homepage inspired by the referenced site while making it clean, original, and production-ready.'
      : userPrompt
  )
  return [
    ...(!isClassicMode(mode) ? [buildModeStarter(mode!, actualPrompt, websiteReference), ''] : []),
    workflow.starterPrompt,
    '',
    'User request:',
    actualPrompt,
  ].join('\n')
}

export function buildRefinePrompt(
  userPrompt: string,
  studio: PromptStudioState,
  fallbackPrompt: string,
  mode?: CanvasModeDefinition,
  websiteReference?: WebsiteReferenceContext | null,
) {
  const workflow = getWorkflowPreset(studio.workflowId)
  const actualPrompt = userPrompt.trim() || fallbackPrompt
  return [
    ...(!isClassicMode(mode) ? [buildModeStarter(mode!, actualPrompt, websiteReference), ''] : []),
    workflow.starterPrompt,
    '',
    'Refinement request:',
    actualPrompt,
  ].join('\n')
}

export function buildPlanPhaseContext(
  studio: PromptStudioState,
  mode?: CanvasModeDefinition,
  websiteReference?: WebsiteReferenceContext | null,
) {
  const workflow = getWorkflowPreset(studio.workflowId)
  const styles = studio.styleIds.map((id) => getBrandStylePreset(id).directive)
  const surface = getStudioOption(SURFACE_OPTIONS, studio.surface)
  const tone = getStudioOption(TONE_OPTIONS, studio.tone)
  const density = getStudioOption(DENSITY_OPTIONS, studio.density)
  const motion = getStudioOption(MOTION_OPTIONS, studio.motion)
  const fidelity = getStudioOption(FIDELITY_OPTIONS, studio.fidelity)

  const sections = [
    ...(!isClassicMode(mode) ? [
      `Mode goal: ${mode!.manifesto.goal}`,
      `Mode creative direction: ${mode!.manifesto.creativeDirection.join(' ')}`,
      'Mode guardrails:',
      ...mode!.manifesto.guardrails.map((line) => `- ${line}`),
    ] : []),
    ...(websiteReference ? [
      `Reference URL: ${websiteReference.url}`,
      'Reference style hints:',
      ...websiteReference.styleHints.map((line) => `- ${line}`),
    ] : []),
    `Workflow focus: ${workflow.directive}`,
    `Surface target: ${surface.directive}`,
    `Tone target: ${tone.directive}`,
    `Density target: ${density.directive}`,
    `Motion target: ${motion.directive}`,
    `Fidelity target: ${fidelity.directive}`,
    'Style cues:',
    ...styles.map((style) => `- ${style}`),
  ]

  const mutation = !isClassicMode(mode) ? getModeMutationDirective(mode!, workflow.id) : ''
  if (mutation) {
    sections.push(`Mode mutation: ${mutation}`)
  }

  return sections.join('\n')
}
