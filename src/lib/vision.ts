import { analyzeVision, type Message } from './api'
import {
  getActiveModelId,
  getProvider,
  getProviderConfigError,
  getProviderModelKey,
  isModelVisionEnabled,
  type CustomProviderConfig,
  type ProviderState,
  type VisionSupportMap,
} from './providers'

export interface VisionRoutingConfig {
  supportMap: VisionSupportMap
  analyzerState: ProviderState
}

export interface VisionDispatchResult {
  usesDirectVision: boolean
  preparedMessages: Message[]
  analyzerSummary?: string
}

const VISION_ANALYZER_PROMPT = `You are the visual analysis stage for a UI-to-code workflow.

Study the provided images and output a precise structured brief for a code generation model.

Rules:
- Do not generate HTML, CSS, or JavaScript.
- Do not call tools or mention tools.
- Focus on what is visible and what the user is asking for.
- If there is a current rendered screenshot, treat it as the existing implementation state.
- If there are sketches or references, treat them as intent and design direction.
- Output concise markdown with these sections in order:
  1. Goal
  2. Visible Structure
  3. Content And Labels
  4. Visual Style
  5. Interaction / Behavior
  6. Constraints For Code Generation
- Be concrete. Avoid filler and avoid speculation beyond what supports implementation.`

function cloneWithoutImages(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (typeof message.content === 'string') return message

    return {
      ...message,
      content: message.content.filter((part: any) => part.type === 'text'),
    }
  })
}

function mergeSummaryIntoMessages(messages: Message[], summaryText: string): Message[] {
  const cloned = cloneWithoutImages(messages)
  const lastUserIndex = [...cloned].reverse().findIndex((message) => message.role === 'user')
  if (lastUserIndex === -1) return cloned

  const userIndex = cloned.length - 1 - lastUserIndex
  const userMessage = cloned[userIndex]
  const textParts = typeof userMessage.content === 'string'
    ? [{ type: 'text', text: userMessage.content }]
    : [...userMessage.content]

  textParts.push({
    type: 'text',
    text: `Vision analysis summary:\n\n${summaryText}`,
  })

  cloned[userIndex] = {
    ...userMessage,
    content: textParts,
  }

  return cloned
}

function buildAnalyzerMessages(messages: Message[]): Message[] {
  const nonSystemMessages = messages.filter((message) => message.role !== 'system')

  return [
    { role: 'system', content: VISION_ANALYZER_PROMPT },
    ...nonSystemMessages,
  ]
}

function hasImageParts(messages: Message[]): boolean {
  return messages.some((message) => {
    if (typeof message.content === 'string') return false
    return message.content.some((part: any) => part.type === 'image' || part.type === 'image_url')
  })
}

function getCustomConfigForState(state: ProviderState): CustomProviderConfig | undefined {
  return state.activeProviderId === 'custom' ? state.custom : undefined
}

export function getVisionRoutingError(
  codeState: ProviderState,
  config: VisionRoutingConfig,
): string | null {
  const provider = getProvider(codeState.activeProviderId)
  const modelId = getActiveModelId(codeState)
  const directVision = isModelVisionEnabled(provider, modelId, config.supportMap, getCustomConfigForState(codeState))
  if (directVision) return null

  const analyzerProvider = getProvider(config.analyzerState.activeProviderId)
  const analyzerModelId = getActiveModelId(config.analyzerState)

  if (getProviderConfigError(config.analyzerState)) {
    return 'provider.validation.visionAnalyzerRequired'
  }

  if (!isModelVisionEnabled(analyzerProvider, analyzerModelId, config.supportMap, getCustomConfigForState(config.analyzerState))) {
    return 'provider.validation.visionAnalyzerMustSupportImages'
  }

  return null
}

export async function prepareVisionMessages(
  codeState: ProviderState,
  messages: Message[],
  config: VisionRoutingConfig,
): Promise<VisionDispatchResult> {
  const provider = getProvider(codeState.activeProviderId)
  const modelId = getActiveModelId(codeState)
  const directVision = isModelVisionEnabled(provider, modelId, config.supportMap, getCustomConfigForState(codeState))

  if (!hasImageParts(messages)) {
    return {
      usesDirectVision: true,
      preparedMessages: messages,
    }
  }

  if (directVision) {
    return {
      usesDirectVision: true,
      preparedMessages: messages,
    }
  }

  const analyzerProvider = getProvider(config.analyzerState.activeProviderId)
  const analyzerModelId = getActiveModelId(config.analyzerState)
  if (getProviderConfigError(config.analyzerState)) {
    throw new Error('provider.validation.visionAnalyzerRequired')
  }
  if (!isModelVisionEnabled(analyzerProvider, analyzerModelId, config.supportMap, getCustomConfigForState(config.analyzerState))) {
    throw new Error('provider.validation.visionAnalyzerMustSupportImages')
  }

  const summary = await analyzeVision(
    analyzerProvider,
    config.analyzerState,
    config.analyzerState.keys[analyzerProvider.id] || '',
    analyzerModelId,
    buildAnalyzerMessages(messages),
  )

  return {
    usesDirectVision: false,
    preparedMessages: mergeSummaryIntoMessages(messages, summary.summaryText),
    analyzerSummary: summary.summaryText,
  }
}

export function updateVisionSupport(
  current: VisionSupportMap,
  providerId: string,
  modelId: string,
  enabled: boolean,
  custom?: CustomProviderConfig,
): VisionSupportMap {
  return {
    ...current,
    [getProviderModelKey(providerId, modelId, custom)]: enabled,
  }
}
