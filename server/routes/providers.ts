import type { FastifyInstance } from 'fastify'
import type { ProviderChannel } from '../../shared/contracts/publicServer'

const providerChannels: ProviderChannel[] = [
  {
    id: 'compatible-openai',
    label: 'Compatible OpenAI',
    apiType: 'openai-compatible',
    models: [],
    verifiedAt: null,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiType: 'openai',
    models: [],
    verifiedAt: null,
  },
  {
    id: 'kimi',
    label: 'Kimi',
    endpoint: 'https://api.moonshot.ai/v1/chat/completions',
    apiType: 'openai-compatible',
    models: [],
    verifiedAt: null,
  },
  { id: 'zai', label: 'z.ai', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'google', label: 'Google', apiType: 'gemini', models: [], verifiedAt: null },
  { id: 'fireworks', label: 'Fireworks', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'openrouter', label: 'OpenRouter', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'modelscope', label: 'ModelScope', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'ollama', label: 'Ollama', apiType: 'ollama', models: [], verifiedAt: null },
  { id: 'dmx', label: 'DMX', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'bailian', label: 'Alibaba Cloud Bailian', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'mimo', label: 'Xiaomi MiMo', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'stepfun', label: 'StepFun', apiType: 'openai-compatible', models: [], verifiedAt: null },
  { id: 'nvidia', label: 'Nvidia', apiType: 'openai-compatible', models: [], verifiedAt: null },
]

export async function registerProviderRoutes(app: FastifyInstance) {
  app.get('/api/providers', async () => ({
    ok: true,
    phase: 'phase-1-provider-governance-placeholder',
    channels: providerChannels,
    note: 'Model capability data is intentionally empty until verified against provider documentation or live APIs.',
  }))

  app.post('/api/providers', async (request) => ({
    ok: true,
    phase: 'phase-1-provider-governance-placeholder',
    received: request.body || null,
    note: 'Provider creation is mocked in phase 1; persistence and encryption land in the account/security phase.',
  }))
}
