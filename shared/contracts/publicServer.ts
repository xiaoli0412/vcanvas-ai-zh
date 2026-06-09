export type UserTier = 'host-admin' | 'admin' | 'vip' | 'user' | 'guest'

export type ExecutionMode = 'browser-local' | 'server-managed'

export type UserPermission =
  | 'manage-site'
  | 'manage-users'
  | 'manage-models'
  | 'manage-gallery'
  | 'use-server-execution'
  | 'publish-gallery'
  | 'manage-own-works'

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
  verifiedAt?: string | null
  verifiedSourceUrl?: string | null
}

export interface ProviderChannel {
  id: string
  label: string
  endpoint?: string
  apiType: 'openai-compatible' | 'openai' | 'azure-openai' | 'gemini' | 'ollama'
  models: ModelCapability[]
  ownerId?: string | null
  apiKeyMasked?: string | null
  apiKeyEncrypted?: ProviderEncryptedSecret | null
  keyCustody?: ProviderKeyCustody | null
  verifiedAt?: string | null
  verifiedSourceUrl?: string | null
  verificationMethod?: 'official-doc' | 'live-models' | 'manual' | null
  verificationNotes?: string | null
  capabilityDetectionConfidence?: 'unknown' | 'low' | 'medium' | 'high'
  lastModelFetchAt?: string | null
  favoriteModelIds?: string[]
  favorite?: boolean
  enabled?: boolean
}

export interface ProviderEncryptedSecret {
  algorithm: 'aes-256-gcm'
  ciphertext: string
  iv: string
  authTag: string
  keyHint: string
  createdAt: string
}

export interface ProviderKeyCustody {
  status: 'none' | 'encrypted-local' | 'masked-only'
  encrypted: boolean
  keyHint?: string | null
  updatedAt?: string | null
  note?: string | null
}

export interface UserProfile {
  displayName: string
  avatarUrl?: string | null
  motto?: string
  qq?: string | null
}

export interface UserAccount {
  id: string
  email?: string | null
  username: string
  tier: UserTier
  profile: UserProfile
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
  lastLoginIp?: string | null
}

export interface SignInRecord {
  id: string
  userId: string
  tier: UserTier
  source?: 'login' | 'register' | 'guest' | 'daily-checkin'
  ip?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface BlockedIp {
  ip: string
  reason: string
  blockedAt: string
  expiresAt?: string | null
  createdBy?: string | null
}

export interface RateLimitEvent {
  id: string
  subject: string
  subjectType: 'ip' | 'user' | 'tier' | 'global'
  route: string
  tier: UserTier
  ip?: string | null
  createdAt: string
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
  action?: WorkflowAction
  modeId: CanvasModeId
  executionMode: ExecutionMode
  prompt: string
  context: WorkflowContext
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
}

export type WorkflowAction = 'generate' | 'refine' | 'plan'

export interface WorkflowRunSummary {
  id: string
  ownerId: string
  action: WorkflowAction | 'unknown'
  modeId: CanvasModeId
  executionMode: ExecutionMode
  promptPreview: string
  status: WorkflowRun['status']
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
  expired: boolean
  contextSummary: {
    carryPolicy?: ContextCarryPolicy
    compressed: boolean
    includePreviousPrompt: boolean
    includePreviousOutput: boolean
    hasPreviousTurn: boolean
    hasWebsiteReference: boolean
    hasVideoReference: boolean
    webEmbedCount: number
    annotationCount: number
    canvasLabelCount: number
  }
}

export interface MaintenanceCleanupCounts {
  workflows: number
  rateLimitEvents: number
  blockedIps: number
  sessions: number
}

export interface MaintenanceCleanupReport {
  dryRun: boolean
  applied: boolean
  generatedAt: string
  before: MaintenanceCleanupCounts
  candidates: MaintenanceCleanupCounts
  removed: MaintenanceCleanupCounts
  after: MaintenanceCleanupCounts
  retention: {
    workflowHours: number
    rateLimitEventHours: number
  }
}

export interface WorkflowExecutionPlan {
  action: WorkflowAction
  executor: ExecutionMode
  plannedOnly: boolean
  reason: string
  contextCompression: {
    applied: boolean
    strategy: 'none' | 'local-summary-v1'
  }
  quota: {
    baseCallsDebited?: number
    baseCallsRemaining?: number
    hostedRunsDebited: number
    hostedRunsRemaining?: number
    resetAt?: string
    hostedResetAt?: string
    gatingReason?: string | null
  }
}

export interface WorkflowServiceResult {
  run: WorkflowRun
  hostingPolicy: HostingPolicy
  executionPlan: WorkflowExecutionPlan
  ownerResolution: {
    requestedOwnerId?: string | null
    ownerOverrideAccepted: boolean
  }
}

export type AssetImportKind = 'image' | 'video' | 'html' | 'web-embed' | 'other'

export interface AssetImportResult {
  id: string
  kind: AssetImportKind
  fileName?: string | null
  mimeType?: string | null
  byteLength?: number | null
  ownerId: string
  executionMode: ExecutionMode
  storage: 'metadata-only'
  accepted: boolean
  reason?: string | null
  createdAt: string
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
  html?: string
  shareSlug?: string | null
  galleryStatus?: GalleryPublicationStatus
  exportMetadata?: {
    exportedAt?: string | null
    includesFlowMap?: boolean
    disclaimerComment?: string
    safetyStatus?: WorkSafetyStatus
  }
  safetyReview?: WorkSafetyReview | null
  disclaimerInjectedAt?: string | null
  createdAt: string
  updatedAt: string
  snapshots: WorkSnapshot[]
}

export interface ShareLink {
  id: string
  workId: string
  ownerId: string
  slug: string
  enabled: boolean
  createdAt: string
  expiresAt?: string | null
  disclaimerComment?: string
  safetyReview?: WorkSafetyReview | null
}

export type GalleryReviewStatus = 'pending-review' | 'published' | 'rejected'

export type GalleryPublicationStatus = 'private' | GalleryReviewStatus

export type WorkSafetyStatus = 'pending' | 'passed' | 'needs-review' | 'blocked'

export interface WorkSafetyReview {
  status: WorkSafetyStatus
  checkedAt: string
  checker: 'local-policy-v1' | 'external-model' | 'manual-admin'
  riskScore: number
  reasons: string[]
  notes?: string | null
}

export type GallerySafetyStatus = WorkSafetyStatus

export type GallerySafetyReview = WorkSafetyReview

export interface GalleryEntry {
  id: string
  workId: string
  ownerId: string
  status: GalleryReviewStatus
  submittedAt: string
  reviewedAt?: string | null
  reviewerId?: string | null
  rejectionReason?: string | null
  safetyReview?: GallerySafetyReview | null
}

export interface QuotaLimitSummary {
  limit: number | null
  used: number
  remaining: number | null
  unlimited: boolean
  reached: boolean
  reason?: string | null
}

export interface WorkGalleryQuotaSummary {
  ownerId: string
  actorId: string
  tier: UserTier
  works: QuotaLimitSummary
  gallerySubmissions: QuotaLimitSummary
  canSubmitGallery: boolean
  galleryReason?: string | null
}

export interface QuotaLedger {
  userId: string
  tier: UserTier
  premiumCredits: number
  baseCallsRemaining: number
  hostedRunsRemaining?: number
  hostedRunsUsedToday?: number
  resetAt: string
  hostedResetAt?: string
}

export interface RedeemCode {
  id: string
  code: string
  tierUpgrade?: UserTier
  premiumCredits?: number
  baseCallCredits?: number
  hostedRunCredits?: number
  expiresAt: string
  maxRedemptions: number
  redeemedCount: number
  redeemedBy?: string[]
  enabled?: boolean
  note?: string | null
  createdBy?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SiteSettings {
  siteName: string
  siteDescription?: string
  publicBaseUrl?: string
  defaultModeId: CanvasModeId
  guestEnabled: boolean
  registrationEnabled?: boolean
  serverExecutionDefault: boolean
  publicGalleryEnabled: boolean
  experimentalFeaturesEnabled: boolean
  securityMode?: 'normal' | 'limited' | 'host-admin-only'
  workLimitPerOwner?: number
  galleryPublishLimits?: Partial<Record<UserTier, number | null>>
  highLoadDegradeThreshold?: number
  longDisclaimer?: string
  sharePolicy?: {
    enabled: boolean
    publicBaseUrl?: string
    pauseOnSecurityWarning?: boolean
  }
  noticePolicy?: {
    forceWarnings: boolean
    allowMarkdown: boolean
    allowImages: boolean
  }
  updatePolicy?: {
    githubRepo: string
    checkEnabled: boolean
    lowTrafficAutoUpdate: boolean
  }
  migrationPolicy?: {
    exportEnabled: boolean
    requireVerification: boolean
  }
  opsPublicEnabled?: boolean
  dispatchPolicy?: {
    enabled: boolean
    strategy: 'round-robin-weighted'
    nodes: DispatchNode[]
  }
}

export interface PersonalSettings {
  userId?: string
  displayName: string
  avatarUrl?: string | null
  motto?: string
  preferredModeId?: CanvasModeId
  favoriteModelKeys?: string[]
  experimental?: {
    serverHighResourceHosting: boolean
  }
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
  windowMode?: 'rolling' | 'natural-day'
}

export interface NoticeMessage {
  id: string
  kind: 'announcement' | 'realtime' | 'warning'
  title: string
  body: string
  format: 'plain' | 'markdown'
  audience: UserTier[] | 'all'
  enabled: boolean
  force?: boolean
  dismissible?: boolean
  imageUrl?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt?: string
}

export interface DisclaimerPolicy {
  shortText: string
  longText: string
  injectOnExport: boolean
  injectOnShare: boolean
}

export interface HostingPolicy {
  defaultExecutionMode: ExecutionMode
  resourceHeavyModeDefault: ExecutionMode
  serverHighResourceHostingEnabled: boolean
  dailyHostedLimit: number
  fallbackReason?: string | null
}

export interface DispatchNode {
  id: string
  url: string
  weight: number
  enabled: boolean
  currentLoad?: number
  lastSeenAt?: string | null
}

export interface DispatchSnapshot {
  strategy: 'round-robin-weighted'
  selectedNode?: DispatchNode | null
  nodes: DispatchNode[]
  message: string
  plannedOnly: boolean
  fallbackReason?: string | null
}

export type PlatformCapabilityDomain =
  | 'auth'
  | 'security'
  | 'models'
  | 'workflows'
  | 'works'
  | 'notices'
  | 'ops'
  | 'migration'

export type PlatformCapabilityMaturity = 'production' | 'local-mock' | 'contract-only' | 'missing'

export interface PlatformCapabilityStatus {
  id: string
  domain: PlatformCapabilityDomain
  title: string
  maturity: PlatformCapabilityMaturity
  summary: string
  implemented: string[]
  gaps: string[]
  nextStep: string
}

export interface PlatformReadinessSnapshot {
  ok: boolean
  generatedAt: string
  branchGoal: 'canvas-2-public-server'
  mode: 'local-json-public-server'
  productName: 'inscanvas'
  overall: {
    productionReady: boolean
    completed: number
    partial: number
    missing: number
    score: number
  }
  principles: {
    canvasFirst: boolean
    defaultLocale: 'zh-CN'
    promptLanguage: 'en'
    compatibleRuntimeNames: string[]
  }
  capabilities: PlatformCapabilityStatus[]
  blockers: string[]
  recommendations: string[]
}

export interface OpsSnapshot {
  takenAt: string
  counts: {
    users: number
    sessions: number
    workflows: number
    works: number
    shareLinks: number
    galleryEntries: number
    rateLimitEvents: number
    blockedIps: number
  }
  hostingPolicy: HostingPolicy
  storage: {
    adapter: 'local-json'
    retentionHours: number
  }
  cleanup?: {
    candidates: MaintenanceCleanupCounts
    retention: MaintenanceCleanupReport['retention']
    checkedAt: string
  }
  highLoadMode: boolean
  dispatch?: DispatchSnapshot
}

export interface DataExportManifest {
  exportedAt: string
  adapter: 'local-json'
  productName?: 'inscanvas'
  schemaVersion?: 'local-json-v1'
  includes: string[]
  counts: Record<string, number>
}

export interface UpdateCheckResult {
  checkedAt: string
  source: 'github-releases' | 'disabled' | 'error'
  repo: string
  currentVersion: string
  latestVersion?: string | null
  updateAvailable: boolean
  comparison: 'newer' | 'current' | 'older' | 'unknown'
  release?: {
    tagName: string
    name?: string | null
    url: string
    publishedAt?: string | null
    prerelease?: boolean
    draft?: boolean
  } | null
  error?: string | null
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
