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

interface PromptBuildOptions {
  modeManifesto?: string
  modeStarter?: string
  workflowContextNotes?: string
}

function joinBullets(lines: string[]) {
  return lines.map((line) => `- ${line}`).join('\n')
}

export function buildSystemPrompt(basePrompt: string, studio: PromptStudioState, options: PromptBuildOptions = {}) {
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
    ...(options.modeManifesto ? ['## Mode Manifesto', options.modeManifesto, ''] : []),
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

export function buildGeneratePrompt(userPrompt: string, studio: PromptStudioState, options: PromptBuildOptions = {}) {
  const workflow = getWorkflowPreset(studio.workflowId)
  return [
    options.modeStarter || '',
    workflow.starterPrompt,
    options.workflowContextNotes || '',
    'User request:',
    userPrompt,
  ].filter(Boolean).join('\n\n')
}

export function buildRefinePrompt(
  userPrompt: string,
  studio: PromptStudioState,
  fallbackPrompt: string,
  options: PromptBuildOptions = {},
) {
  const workflow = getWorkflowPreset(studio.workflowId)
  const actualPrompt = userPrompt.trim() || fallbackPrompt
  return [
    options.modeStarter || '',
    workflow.starterPrompt,
    options.workflowContextNotes || '',
    'Refinement request:',
    actualPrompt,
  ].filter(Boolean).join('\n\n')
}

export function buildPlanPhaseContext(studio: PromptStudioState, options: PromptBuildOptions = {}) {
  const workflow = getWorkflowPreset(studio.workflowId)
  const styles = studio.styleIds.map((id) => getBrandStylePreset(id).directive)
  const surface = getStudioOption(SURFACE_OPTIONS, studio.surface)
  const tone = getStudioOption(TONE_OPTIONS, studio.tone)
  const density = getStudioOption(DENSITY_OPTIONS, studio.density)
  const motion = getStudioOption(MOTION_OPTIONS, studio.motion)
  const fidelity = getStudioOption(FIDELITY_OPTIONS, studio.fidelity)

  return [
    ...(options.modeManifesto ? [`Mode manifesto: ${options.modeManifesto}`] : []),
    ...(options.modeStarter ? [`Mode starter: ${options.modeStarter}`] : []),
    ...(options.workflowContextNotes ? [options.workflowContextNotes] : []),
    `Workflow focus: ${workflow.directive}`,
    `Surface target: ${surface.directive}`,
    `Tone target: ${tone.directive}`,
    `Density target: ${density.directive}`,
    `Motion target: ${motion.directive}`,
    `Fidelity target: ${fidelity.directive}`,
    'Style cues:',
    ...styles.map((style) => `- ${style}`),
  ].join('\n')
}
