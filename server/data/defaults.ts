import type {
  DisclaimerPolicy,
  NoticeMessage,
  PersonalSettings,
  ProviderChannel,
  QuotaLedger,
  RateLimitPolicy,
  SiteSettings,
  UserAccount,
} from '../../shared/contracts/publicServer'

const ZERO_TIME = new Date(0).toISOString()

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'inscanvas Public Server',
  defaultModeId: 'custom',
  guestEnabled: true,
  registrationEnabled: true,
  serverExecutionDefault: false,
  publicGalleryEnabled: false,
  experimentalFeaturesEnabled: true,
  securityMode: 'normal',
  workLimitPerOwner: 10,
  galleryPublishLimits: {
    'host-admin': null,
    admin: null,
    vip: 9,
    user: 6,
    guest: 0,
  },
  highLoadDegradeThreshold: 0.9,
  longDisclaimer: 'inscanvas is a creative canvas platform. Public works and shared exports are user-directed content and must be reviewed by the creator before publication.',
}

export const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
  userId: 'guest-local',
  displayName: 'Guest',
  avatarUrl: null,
  motto: 'Canvas first.',
  preferredModeId: 'custom',
  favoriteModelKeys: [],
  experimental: {
    serverHighResourceHosting: false,
  },
}

export const DEFAULT_DISCLAIMER_POLICY: DisclaimerPolicy = {
  shortText: 'Generated with inscanvas. Creator, IP/time metadata, and site disclaimer may be embedded for traceability.',
  longText: 'inscanvas is a creative canvas and model orchestration tool. Generated works are user-directed outputs and must be reviewed by the user before publishing, exporting, or sharing.',
  injectOnExport: true,
  injectOnShare: true,
}

export const DEFAULT_RATE_LIMIT_POLICIES: RateLimitPolicy[] = [
  {
    id: 'guest-ip-daily',
    scope: 'ip',
    enabled: true,
    windowSeconds: 24 * 60 * 60,
    maxRequests: 8,
    lockoutSeconds: 6 * 60 * 60,
  },
  {
    id: 'user-hourly-basic',
    scope: 'user',
    enabled: true,
    windowSeconds: 60 * 60,
    maxRequests: 20,
  },
]

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'local-admin',
    email: null,
    username: 'local-admin',
    tier: 'host-admin',
    profile: {
      displayName: 'inscanvas owner',
      avatarUrl: null,
      motto: 'Canvas first.',
      qq: null,
    },
    enabled: true,
    createdAt: ZERO_TIME,
    updatedAt: ZERO_TIME,
    lastLoginAt: null,
    lastLoginIp: null,
  },
]

export const DEFAULT_QUOTA_LEDGERS: QuotaLedger[] = [
  {
    userId: 'guest-local',
    tier: 'guest',
    premiumCredits: 0,
    baseCallsRemaining: 8,
    hostedRunsRemaining: 0,
    resetAt: ZERO_TIME,
    hostedResetAt: ZERO_TIME,
  },
  {
    userId: 'local-admin',
    tier: 'host-admin',
    premiumCredits: 999999,
    baseCallsRemaining: 999999,
    hostedRunsRemaining: 999999,
    resetAt: ZERO_TIME,
    hostedResetAt: ZERO_TIME,
  },
]

export const DEFAULT_NOTICES: NoticeMessage[] = [
  {
    id: 'phase-2-public-server',
    kind: 'announcement',
    title: 'inscanvas public server phase 2',
    body: 'Canvas-first mode, local persistence, provider governance, and public-server contracts are active in this branch.',
    format: 'plain',
    audience: 'all',
    enabled: true,
    createdAt: ZERO_TIME,
    updatedAt: ZERO_TIME,
  },
]

// New channels intentionally avoid unverified hardcoded model lists.
// Built-in model rows should only be added after official-doc or live /models verification.
export const DEFAULT_PROVIDER_CHANNELS: ProviderChannel[] = [
  {
    id: 'compatible-openai',
    label: 'Compatible OpenAI',
    apiType: 'openai-compatible',
    models: [],
    verifiedAt: null,
    verifiedSourceUrl: null,
    favorite: true,
    enabled: true,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiType: 'openai',
    models: [],
    verifiedAt: null,
    verifiedSourceUrl: 'https://platform.openai.com/docs/api-reference/chat/create',
    favorite: true,
    enabled: true,
  },
  {
    id: 'kimi',
    label: 'Kimi',
    endpoint: 'https://api.moonshot.ai/v1/chat/completions',
    apiType: 'openai-compatible',
    models: [],
    verifiedAt: null,
    verifiedSourceUrl: 'https://platform.kimi.ai/docs/api/overview',
    favorite: true,
    enabled: true,
  },
  { id: 'zai', label: 'z.ai', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: null, enabled: true },
  { id: 'google', label: 'Google', apiType: 'gemini', models: [], verifiedAt: null, verifiedSourceUrl: 'https://ai.google.dev/gemini-api/docs/models', enabled: true },
  { id: 'fireworks', label: 'Fireworks', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://docs.fireworks.ai/', enabled: true },
  { id: 'openrouter', label: 'OpenRouter', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://openrouter.ai/docs', enabled: true },
  { id: 'modelscope', label: 'ModelScope', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://www.modelscope.cn/docs', enabled: true },
  { id: 'ollama', label: 'Ollama', apiType: 'ollama', models: [], verifiedAt: null, verifiedSourceUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md', enabled: true },
  { id: 'dmx', label: 'DMX', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: null, enabled: true },
  { id: 'bailian', label: 'Alibaba Cloud Bailian', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://help.aliyun.com/zh/model-studio/', enabled: true },
  { id: 'mimo', label: 'Xiaomi MiMo', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: null, enabled: true },
  { id: 'stepfun', label: 'StepFun', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://platform.stepfun.com/docs', enabled: true },
  { id: 'nvidia', label: 'Nvidia', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://docs.nvidia.com/nim/', enabled: true },
]
