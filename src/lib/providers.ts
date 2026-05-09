/** Provider and model configuration */

import { resolveProxyUrl, shouldUseProxyFirst } from './proxy'

export type ApiType = 'openai' | 'gemini'
export type CustomMode = 'openai' | 'azure' | 'compatible'

export interface ModelDef {
  id: string
  label: string
  vision?: boolean
}

export interface ProviderDef {
  id: string
  name: string
  type: ApiType
  endpoint?: string
  models: ModelDef[]
  keyHintKey: string
  keyUrl: string
  keyUrlLabel: string
  storageKey: string
  customConfig?: boolean
  fetchModels?: boolean
}

export interface CustomProviderConfig {
  mode: CustomMode
  baseUrl?: string
  endpoint?: string
  modelId?: string
  resourceUrl?: string
  deployment?: string
  apiVersion?: string
}

export interface ProviderState {
  activeProviderId: string
  activeModelId: string
  keys: Record<string, string>
  custom: CustomProviderConfig
}

export interface FetchOptions {
  headers?: Record<string, string>
  body?: string
  method?: string
  signal?: AbortSignal
}

export interface ResolvedProviderRequest {
  endpoint: string
  headers: Record<string, string>
  query?: Record<string, string>
  modelId: string
  useProxy?: boolean
}

function withBearer(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

async function fetchWithOptionalProxy(url: string, options: FetchOptions = {}, useProxy = false) {
  const method = options.method || (options.body ? 'POST' : 'GET')
  const proxyRequest = () => resolveProxyUrl().then((proxyUrl) => fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      method,
      headers: options.headers || {},
      body: options.body,
    }),
    signal: options.signal,
  }))

  if (useProxy && await shouldUseProxyFirst()) {
    return proxyRequest()
  }

  try {
    return await fetch(url, {
      method,
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    })
  } catch (error) {
    if (!useProxy) throw error
  }

  return proxyRequest()
}

const DEFAULT_CUSTOM: CustomProviderConfig = {
  mode: 'compatible',
  endpoint: '',
  modelId: '',
  apiVersion: '2024-10-21',
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'zai',
    name: 'z.ai',
    type: 'openai',
    endpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
    models: [
      { id: 'glm-5v-turbo', label: 'GLM-5V Turbo', vision: true },
    ],
    keyHintKey: 'provider.keyHint.zai',
    keyUrl: 'https://z.ai',
    keyUrlLabel: 'z.ai',
    storageKey: 'glm5v_key',
  },
  {
    id: 'google',
    name: 'Google',
    type: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', vision: true },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3.1 Flash', vision: true },
      { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', vision: true },
    ],
    keyHintKey: 'provider.keyHint.google',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyUrlLabel: 'AI Studio',
    storageKey: 'gemini_key',
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    type: 'openai',
    endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
    models: [
      { id: 'accounts/fireworks/routers/kimi-k2p5-turbo', label: 'Kimi K2.5 Turbo', vision: true },
    ],
    keyHintKey: 'provider.keyHint.fireworks',
    keyUrl: 'https://app.fireworks.ai/fire-pass',
    keyUrlLabel: 'Fire Pass',
    storageKey: 'fireworks_key',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openai',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    fetchModels: true,
    models: [
      { id: 'anthropic/claude-4.6-sonnet-20260217', label: 'Claude 4.6 Sonnet', vision: true },
      { id: 'anthropic/claude-opus-4.6', label: 'Claude 4.6 Opus', vision: true },
      { id: 'google/gemini-3-flash-preview-20251217', label: 'Gemini 3 Flash', vision: true },
      { id: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast', vision: true },
      { id: 'qwen/qwen3.5-plus-02-15', label: 'Qwen 3.5 Plus', vision: true },
      { id: 'xiaomi/mimo-v2-omni', label: 'MiMo V2 Omni', vision: true },
      { id: 'moonshotai/kimi-k2.5-0127', label: 'Kimi K2.5', vision: true },
    ],
    keyHintKey: 'provider.keyHint.openrouter',
    keyUrl: 'https://openrouter.ai/keys',
    keyUrlLabel: 'OpenRouter',
    storageKey: 'openrouter_key',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI',
    type: 'openai',
    models: [],
    keyHintKey: 'provider.keyHint.custom',
    keyUrl: '',
    keyUrlLabel: '',
    storageKey: 'custom_key',
    customConfig: true,
  },
]

const STORAGE_KEY = 'vcanvas_provider_state'

export function getProvider(id: string): ProviderDef {
  return PROVIDERS.find(p => p.id === id) || PROVIDERS[0]
}

function normalizeUrl(value?: string) {
  return value?.trim().replace(/\/+$/, '') || ''
}

function ensurePath(url: string, path: string) {
  const normalized = normalizeUrl(url)
  if (!normalized) return ''
  if (normalized.toLowerCase().endsWith(path.toLowerCase())) return normalized
  return normalized + path
}

function ensureCompatibleEndpoint(url: string) {
  const normalized = normalizeUrl(url)
  if (!normalized) return ''
  if (/\/chat\/completions$/i.test(normalized)) return normalized
  if (/\/v1$/i.test(normalized)) return ensurePath(normalized, '/chat/completions')
  return ensurePath(`${normalized}/v1`, '/chat/completions')
}

function isAbsoluteUrl(value?: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function migrateLegacyCustom(raw: any): CustomProviderConfig {
  const mode = raw?.custom?.mode || 'compatible'
  return {
    mode,
    baseUrl: raw?.custom?.baseUrl || '',
    endpoint: raw?.custom?.endpoint || raw?.customEndpoint || '',
    modelId: raw?.custom?.modelId || raw?.customModelId || raw?.activeModelId || '',
    resourceUrl: raw?.custom?.resourceUrl || '',
    deployment: raw?.custom?.deployment || '',
    apiVersion: raw?.custom?.apiVersion || '2024-10-21',
  }
}

export function makeDefaultProviderState(): ProviderState {
  const keys: Record<string, string> = {}
  for (const p of PROVIDERS) {
    const oldKey = localStorage.getItem(p.storageKey)
    if (oldKey) keys[p.id] = oldKey
  }

  const oldProvider = localStorage.getItem('vcanvas_provider')
  let activeProviderId = PROVIDERS[0].id
  if (oldProvider === 'glm5v') activeProviderId = 'zai'
  else if (oldProvider === 'gemini') activeProviderId = 'google'

  const provider = getProvider(activeProviderId)
  return {
    activeProviderId,
    activeModelId: provider.models[0]?.id || '',
    keys,
    custom: { ...DEFAULT_CUSTOM },
  }
}

export function loadProviderState(): ProviderState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (!parsed.keys) parsed.keys = {}
      for (const p of PROVIDERS) {
        if (!parsed.keys[p.id]) {
          const oldKey = localStorage.getItem(p.storageKey)
          if (oldKey) parsed.keys[p.id] = oldKey
        }
      }
      if (!PROVIDERS.find(p => p.id === parsed.activeProviderId)) {
        parsed.activeProviderId = PROVIDERS[0].id
      }
      const provider = getProvider(parsed.activeProviderId)
      const activeModelId = parsed.activeProviderId === 'custom'
        ? (parsed.custom?.modelId || parsed.customModelId || '')
        : (parsed.activeModelId || provider.models[0]?.id || '')

      return {
        activeProviderId: parsed.activeProviderId,
        activeModelId,
        keys: parsed.keys,
        custom: migrateLegacyCustom(parsed),
      }
    }
  } catch { /* ignore */ }

  return makeDefaultProviderState()
}

export function saveProviderState(state: ProviderState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function getActiveModelId(state: ProviderState): string {
  if (state.activeProviderId === 'custom') return state.custom.modelId?.trim() || ''
  return state.activeModelId
}

export function getCustomConfigError(custom: CustomProviderConfig, apiKey: string): string | null {
  return getCustomConfigErrorForPurpose(custom, apiKey, 'request')
}

export function getCustomConfigErrorForPurpose(
  custom: CustomProviderConfig,
  apiKey: string,
  purpose: 'request' | 'models',
): string | null {
  const needsModel = purpose === 'request'

  if (custom.mode === 'openai') {
    if (!custom.baseUrl?.trim()) return 'provider.validation.openaiBaseUrlRequired'
    if (!isAbsoluteUrl(custom.baseUrl.trim())) return 'provider.validation.invalidUrl'
    if (needsModel && !custom.modelId?.trim()) return 'provider.validation.customModelRequired'
    if (apiKey.trim().length <= 4) return 'provider.validation.apiKeyRequired'
    return null
  }

  if (custom.mode === 'azure') {
    if (!custom.resourceUrl?.trim()) return 'provider.validation.azureResourceUrlRequired'
    if (!isAbsoluteUrl(custom.resourceUrl.trim())) return 'provider.validation.invalidUrl'
    if (!custom.deployment?.trim()) return 'provider.validation.azureDeploymentRequired'
    if (!custom.apiVersion?.trim()) return 'provider.validation.azureApiVersionRequired'
    if (apiKey.trim().length <= 4) return 'provider.validation.apiKeyRequired'
    return null
  }

  const endpoint = custom.endpoint?.trim() || custom.baseUrl?.trim() || ''
  if (!endpoint) return 'provider.validation.compatibleEndpointRequired'
  if (!isAbsoluteUrl(endpoint)) return 'provider.validation.invalidUrl'
  if (needsModel && !custom.modelId?.trim()) return 'provider.validation.customModelRequired'
  return null
}

export function getProviderConfigError(state: ProviderState): string | null {
  if (state.activeProviderId !== 'custom') {
    return (state.keys[state.activeProviderId] || '').trim().length > 4
      ? null
      : 'provider.validation.apiKeyRequired'
  }

  return getCustomConfigError(state.custom, state.keys.custom || '')
}

export function isProviderConfigured(state: ProviderState): boolean {
  return getProviderConfigError(state) === null
}

export function resolveProviderRequest(provider: ProviderDef, state: ProviderState, apiKey: string): ResolvedProviderRequest {
  if (provider.id !== 'custom') {
    if (!provider.endpoint) {
      throw new Error('provider.error.noEndpoint')
    }
    return {
      endpoint: provider.endpoint,
      headers: withBearer(apiKey),
      modelId: state.activeModelId,
    }
  }

  const custom = state.custom
  const modelId = custom.modelId?.trim() || ''
  const validationError = getCustomConfigError(custom, apiKey)
  if (validationError) {
    throw new Error(validationError)
  }

  if (custom.mode === 'azure') {
    const resourceUrl = normalizeUrl(custom.resourceUrl)
    const deployment = custom.deployment?.trim() || ''
    const apiVersion = custom.apiVersion?.trim() || ''
    return {
      endpoint: `${resourceUrl}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      query: { 'api-version': apiVersion },
      modelId,
      useProxy: true,
    }
  }

  if (custom.mode === 'openai') {
    const baseUrl = normalizeUrl(custom.baseUrl)
    const endpoint = /\/chat\/completions$/i.test(baseUrl)
      ? baseUrl
      : ensurePath(/\/v1$/i.test(baseUrl) ? baseUrl : `${baseUrl}/v1`, '/chat/completions')
    return {
      endpoint,
      headers: withBearer(apiKey),
      modelId,
      useProxy: true,
    }
  }

  const endpointOrBase = normalizeUrl(custom.endpoint || custom.baseUrl)
  const endpoint = ensureCompatibleEndpoint(endpointOrBase)

  return {
    endpoint,
    headers: withBearer(apiKey),
    modelId,
    useProxy: true,
  }
}

/** Fetch vision-capable models from OpenRouter API */
export async function fetchOpenRouterModels(): Promise<ModelDef[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(`OpenRouter API ${res.status}`)
  const data = await res.json()
  const models: ModelDef[] = []
  for (const m of data.data || []) {
    const modalities = m.architecture?.input_modalities
    if (Array.isArray(modalities) && modalities.includes('image')) {
      models.push({
        id: m.id,
        label: (m.name || m.id).replace(/^[^:]+:\s*/, ''),
        vision: true,
      })
    }
  }
  return models
}

export async function fetchCustomModels(state: ProviderState, apiKey: string): Promise<ModelDef[]> {
  const provider = getProvider('custom')
  const validationError = getCustomConfigErrorForPurpose(state.custom, apiKey, 'models')
  if (validationError) {
    throw new Error(validationError)
  }

  const request = resolveProviderRequest(provider, {
    ...state,
    custom: {
      ...state.custom,
      modelId: state.custom.modelId?.trim() || '__fetch_models__',
    },
  }, apiKey)
  const target = state.custom.mode === 'azure'
    ? new URL(`${normalizeUrl(state.custom.resourceUrl)}/openai/models`)
    : new URL(request.endpoint)

  if (state.custom.mode === 'azure') {
    target.searchParams.set('api-version', state.custom.apiVersion?.trim() || DEFAULT_CUSTOM.apiVersion || '2024-10-21')
  } else {
    target.pathname = target.pathname.replace(/\/chat\/completions$/i, '/models')
    target.search = ''
  }

  const response = await fetchWithOptionalProxy(target.toString(), {
    headers: request.headers,
    method: 'GET',
  }, !!request.useProxy)

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    let detail = errText.trim()

    if (detail) {
      try {
        const parsed = JSON.parse(detail)
        detail = parsed?.error?.message || parsed?.error || parsed?.message || detail
      } catch {
        detail = detail.replace(/\s+/g, ' ').trim()
      }
    }

    const statusLabel = `Custom models ${response.status}`
    throw new Error(detail ? `${statusLabel}: ${detail}` : statusLabel)
  }

  const data = await response.json()
  const models = Array.isArray(data?.data) ? data.data : []
  const seen = new Set<string>()
  return models
    .map((item: any) => ({
      id: item.id,
      label: item.id,
      vision: /vision|omni|kimi|gemini|glm|gpt|mimo/i.test(String(item.id || '')),
    }))
    .filter((item: ModelDef) => {
      if (!item.id || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
}
