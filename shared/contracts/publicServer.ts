export type UserTier = 'host-admin' | 'admin' | 'vip' | 'user' | 'guest'

export type ExecutionMode = 'browser-local' | 'server-managed'

export type CanvasModeId =
  | 'custom'
  | 'pure'
  | 'video'
  | 'web-copy'
  | 'inspiration'
  | 'cinema'
  | 'lite-app'
  | 'eclectic'
  | 'ppt'
  | 'docs'
  | 'showcase'
  | 'frontier'

export type ContextCarryPolicy = 'disabled' | 'last-turn' | 'full'

export interface ProviderCapability {
  vision: boolean
  video?: boolean
  toolCalling?: boolean
  contextWindow?: number
  serverSide?: boolean
}

export interface ModelCapability extends ProviderCapability {
  id: string
  label: string
  source: 'builtin' | 'fetched' | 'manual'
  favorite?: boolean
}

export interface ProviderChannel {
  id: string
  label: string
  endpoint?: string
  apiType: 'openai-compatible' | 'openai' | 'azure-openai' | 'gemini' | 'ollama'
  models: ModelCapability[]
  verifiedAt?: string | null
}

export interface WebsiteReferenceContext {
  url: string
  html: string
  rebasedHtml?: string
  screenshotDataUrl?: string | null
  stylesheetSnippets: string[]
  styleHints: string[]
  fetchedAt: string
  error?: string | null
}

export interface WebEmbedReference {
  id: string
  url: string
  title: string
  frameId?: string | null
  status: 'idle' | 'preview-ready' | 'blocked' | 'error'
  error?: string | null
  createdAt: string
  updatedAt: string
}

export interface PreviewAnnotation {
  id: string
  x: number
  y: number
  text: string
  createdAt: string
}

export interface VideoReference {
  id: string
  fileName: string
  duration: number
  selectedKeyframeIds: string[]
  createdAt: string
  error?: string | null
}

export interface WorkflowTurnReference {
  id: string
  modeId: CanvasModeId
  prompt: string
  html?: string
  screenshotDataUrl?: string | null
  createdAt: string
}

export interface WorkflowContext {
  modeId: CanvasModeId
  prompt: string
  carryPolicy: ContextCarryPolicy
  currentCanvasLabels: string[]
  currentOutputHtml?: string
  previousTurn?: WorkflowTurnReference | null
  includePreviousPrompt: boolean
  includePreviousOutput: boolean
  includePreviousScreenshot: boolean
  websiteReference?: WebsiteReferenceContext | null
  webEmbeds?: WebEmbedReference[]
  previewAnnotations?: PreviewAnnotation[]
  videoReference?: VideoReference | null
}

export interface WorkflowRun {
  id: string
  ownerId: string
  modeId: CanvasModeId
  executionMode: ExecutionMode
  prompt: string
  context: WorkflowContext
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
}

export interface WorkSnapshot {
  id: string
  workId: string
  html?: string
  canvasData?: string
  previewImageUrl?: string | null
  createdAt: string
}

export interface WorkRecord {
  id: string
  ownerId: string
  title: string
  description?: string
  modeId: CanvasModeId
  status: 'draft' | 'saved' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
  snapshots: WorkSnapshot[]
}

export interface QuotaLedger {
  userId: string
  tier: UserTier
  premiumCredits: number
  baseCallsRemaining: number
  resetAt: string
}

export interface RedeemCode {
  id: string
  code: string
  tierUpgrade?: UserTier
  premiumCredits?: number
  expiresAt: string
  maxRedemptions: number
  redeemedCount: number
}

export interface SiteSettings {
  siteName: string
  defaultModeId: CanvasModeId
  guestEnabled: boolean
  serverExecutionDefault: boolean
  publicGalleryEnabled: boolean
  experimentalFeaturesEnabled: boolean
}

export interface PersonalSettings {
  displayName: string
  avatarUrl?: string | null
  motto?: string
  preferredModeId?: CanvasModeId
}

export interface AuthSession {
  id: string
  userId: string
  tier: UserTier
  executionMode: ExecutionMode
  lastActiveAt: string
  expiresAt: string
  ip?: string | null
  userAgent?: string | null
}

export interface RateLimitPolicy {
  id: string
  scope: 'ip' | 'user' | 'tier' | 'global'
  enabled: boolean
  windowSeconds: number
  maxRequests: number
  lockoutSeconds?: number
}

export interface NoticeMessage {
  id: string
  kind: 'announcement' | 'realtime' | 'warning'
  title: string
  body: string
  format: 'plain' | 'markdown'
  audience: UserTier[] | 'all'
  enabled: boolean
  createdAt: string
}

export interface DisclaimerPolicy {
  shortText: string
  longText: string
  injectOnExport: boolean
  injectOnShare: boolean
}

export interface AuditEvent {
  id: string
  actorId?: string | null
  actorTier: UserTier
  action: string
  ip?: string | null
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface NewApiBridge {
  kind: 'newapi'
  available: boolean
}

export interface SubapiBridge {
  kind: 'subapi'
  available: boolean
}

export interface OctopusBridge {
  kind: 'octopus'
  available: boolean
}
