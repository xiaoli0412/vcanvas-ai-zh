import type { FastifyRequest } from 'fastify'
import type {
  AuthSession,
  CanvasModeId,
  DisclaimerPolicy,
  ExecutionMode,
  GalleryEntry,
  HostingPolicy,
  ProviderChannel,
  DispatchSnapshot,
  UserAccount,
  UserPermission,
  UserTier,
} from '../../shared/contracts/publicServer'
import { createId, getClientIp, type PublicServerData } from '../data/localDataStore'

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000
export const WORKFLOW_TTL_MS = 24 * 60 * 60 * 1000
const RATE_EVENT_RETENTION_MS = 48 * 60 * 60 * 1000

const TIER_RANK: Record<UserTier, number> = {
  guest: 0,
  user: 1,
  vip: 2,
  admin: 3,
  'host-admin': 4,
}

export function getTierPermissions(tier: UserTier): UserPermission[] {
  if (tier === 'host-admin') {
    return ['manage-site', 'manage-users', 'manage-models', 'manage-gallery', 'use-server-execution', 'publish-gallery', 'manage-own-works']
  }
  if (tier === 'admin') {
    return ['manage-users', 'manage-models', 'manage-gallery', 'use-server-execution', 'publish-gallery', 'manage-own-works']
  }
  if (tier === 'vip') return ['use-server-execution', 'publish-gallery', 'manage-own-works']
  if (tier === 'user') return ['use-server-execution', 'publish-gallery', 'manage-own-works']
  return ['manage-own-works']
}

export function canManageSecrets(tier: UserTier) {
  return tier === 'host-admin' || tier === 'admin'
}

export function canManageUsers(tier: UserTier) {
  return getTierPermissions(tier).includes('manage-users')
}

export function resolveOwnedTargetId(actor: { id: string; tier: UserTier }, requestedOwnerId?: string | null) {
  const ownerId = requestedOwnerId?.trim()
  if (ownerId && canManageUsers(actor.tier)) {
    return { ownerId, requestedOwnerId: ownerId, ownerOverrideAccepted: true }
  }
  return {
    ownerId: actor.id,
    requestedOwnerId: ownerId || null,
    ownerOverrideAccepted: false,
  }
}

export function normalizeTier(value?: string): UserTier {
  if (value === 'host-admin' || value === 'admin' || value === 'vip' || value === 'user' || value === 'guest') return value
  return 'user'
}

export function resolveLocalLoginTier(data: PublicServerData, userId: string): UserTier {
  const existing = data.users.find((user) => user.id === userId)
  if (existing) return existing.tier
  if (userId === 'local-admin') return 'host-admin'
  return 'user'
}

export function resolveLocalRegisterTier(data: PublicServerData, userId: string): UserTier {
  const existing = data.users.find((user) => user.id === userId)
  if (existing) return existing.tier
  return userId === 'local-admin' ? 'host-admin' : 'user'
}

export function makeSession(input: {
  userId: string
  tier: UserTier
  executionMode?: ExecutionMode
  ip?: string | null
  userAgent?: string | null
}): AuthSession {
  const now = new Date()
  return {
    id: createId('session'),
    userId: input.userId,
    tier: input.tier,
    executionMode: input.executionMode || (input.tier === 'guest' ? 'browser-local' : 'server-managed'),
    lastActiveAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    ip: input.ip || null,
    userAgent: input.userAgent || null,
  }
}

export function getSessionFromRequest(data: PublicServerData, request: FastifyRequest): AuthSession | null {
  const now = Date.now()
  const sessionId = typeof request.headers['x-vcanvas-session-id'] === 'string' ? request.headers['x-vcanvas-session-id'] : ''
  const userId = typeof request.headers['x-vcanvas-user-id'] === 'string' ? request.headers['x-vcanvas-user-id'] : ''
  const activeSessions = data.sessions
    .filter((session) => Date.parse(session.expiresAt) > now)
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))

  if (!sessionId) return null
  const session = activeSessions.find((item) => item.id === sessionId) || null
  if (!session) return null
  if (userId && session.userId !== userId) return null
  return session
}

export function getActor(data: PublicServerData, request: FastifyRequest) {
  const session = getSessionFromRequest(data, request)
  if (!session) {
    return {
      id: 'guest-local',
      tier: 'guest' as UserTier,
      session: null,
      displayName: 'Guest',
    }
  }
  const user = data.users.find((item) => item.id === session.userId)
  return {
    id: session.userId,
    tier: session.tier,
    session,
    displayName: user?.profile.displayName || (session.tier === 'guest' ? 'Guest' : 'inscanvas user'),
  }
}

export function upsertUser(data: PublicServerData, input: {
  id: string
  username?: string
  email?: string | null
  tier: UserTier
  displayName?: string
  ip?: string | null
}) {
  const now = new Date().toISOString()
  const existing = data.users.find((user) => user.id === input.id)
  const next: UserAccount = {
    id: input.id,
    email: input.email ?? existing?.email ?? null,
    username: input.username || existing?.username || input.id,
    tier: input.tier,
    profile: {
      displayName: input.displayName || existing?.profile.displayName || 'inscanvas user',
      avatarUrl: existing?.profile.avatarUrl || null,
      motto: existing?.profile.motto || '画布优先。',
      qq: existing?.profile.qq || null,
    },
    enabled: existing?.enabled ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastLoginAt: now,
    lastLoginIp: input.ip || null,
  }
  data.users = [...data.users.filter((user) => user.id !== input.id), next]
  ensureQuotaLedger(data, input.id, input.tier)
  return next
}

export function ensureQuotaLedger(data: PublicServerData, userId: string, tier: UserTier) {
  const existing = data.quotaLedgers.find((ledger) => ledger.userId === userId)
  if (existing) {
    existing.tier = tier
    return existing
  }
  const now = new Date()
  const hostedRunsRemaining = tier === 'vip' || tier === 'user' ? 2 : tier === 'guest' ? 0 : 999999
  const ledger = {
    userId,
    tier,
    premiumCredits: tier === 'guest' ? 0 : 100,
    baseCallsRemaining: tier === 'guest' ? 8 : 20,
    hostedRunsRemaining,
    resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    hostedResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
  data.quotaLedgers.push(ledger)
  return ledger
}

export function maskProviderChannels(channels: ProviderChannel[], actorTier: UserTier, actorId: string) {
  return channels.map((channel) => {
    if (canManageSecrets(actorTier) || !channel.ownerId || channel.ownerId === actorId) return channel
    return {
      ...channel,
      endpoint: channel.endpoint ? '[hidden]' : channel.endpoint,
      apiKeyMasked: channel.apiKeyMasked ? '********' : channel.apiKeyMasked,
    }
  })
}

export function buildDisclaimerComment(policy: DisclaimerPolicy, metadata: { ip?: string | null; time?: string; action: 'save' | 'export' | 'share' }) {
  const time = metadata.time || new Date().toISOString()
  return `Generated with inscanvas | action=${metadata.action} | ip=${metadata.ip || 'unknown'} | time=${time} | ${policy.shortText}`
}

export function injectDisclaimerComment(html: string | undefined, comment: string) {
  if (!html) return html
  if (html.includes('Generated with inscanvas')) return html
  const note = `<!-- ${comment.replace(/--/g, '- -')} -->`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${note}\n</body>`)
  return `${note}\n${html}`
}

export function galleryLimitForTier(data: PublicServerData, tier: UserTier) {
  const configured = data.siteSettings.galleryPublishLimits?.[tier]
  if (configured === null) return Infinity
  if (typeof configured === 'number') return configured
  if (tier === 'host-admin' || tier === 'admin') return Infinity
  if (tier === 'vip') return 9
  if (tier === 'user') return 6
  return 0
}

export function canSubmitGallery(data: PublicServerData, actorId: string, tier: UserTier) {
  const limit = galleryLimitForTier(data, tier)
  if (limit <= 0) return { ok: false, limit, count: 0, reason: 'This tier cannot publish to gallery.' }
  if (limit === Infinity) return { ok: true, limit, count: 0 }
  const count = data.galleryEntries.filter((entry) => entry.ownerId === actorId && entry.status !== 'rejected').length
  return count < limit
    ? { ok: true, limit, count }
    : { ok: false, limit, count, reason: `Gallery publish limit reached (${limit}).` }
}

export function createGalleryEntry(input: { workId: string; ownerId: string; status?: GalleryEntry['status'] }): GalleryEntry {
  const now = new Date().toISOString()
  return {
    id: createId('gallery'),
    workId: input.workId,
    ownerId: input.ownerId,
    status: input.status || 'pending-review',
    submittedAt: now,
    reviewedAt: null,
    reviewerId: null,
    rejectionReason: null,
  }
}

function isResourceHeavyMode(modeId: CanvasModeId) {
  return modeId === 'video' || modeId === 'web-copy'
}

export function resolveHostingPolicy(data: PublicServerData, input: {
  modeId: CanvasModeId
  actorId: string
  tier: UserTier
}): HostingPolicy {
  const personalEnabled = data.personalSettings.experimental?.serverHighResourceHosting === true
  const ledger = ensureQuotaLedger(data, input.actorId, input.tier)
  const canUseServer = input.tier !== 'guest' && getTierPermissions(input.tier).includes('use-server-execution')
  const heavy = isResourceHeavyMode(input.modeId)
  const highLoadMode = data.siteSettings.securityMode === 'limited'

  if (!canUseServer) {
    return {
      defaultExecutionMode: 'browser-local',
      resourceHeavyModeDefault: 'browser-local',
      serverHighResourceHostingEnabled: false,
      dailyHostedLimit: 0,
      fallbackReason: 'guest-browser-local',
    }
  }

  if (heavy && (!personalEnabled || (ledger.hostedRunsRemaining || 0) <= 0)) {
    return {
      defaultExecutionMode: 'server-managed',
      resourceHeavyModeDefault: 'browser-local',
      serverHighResourceHostingEnabled: personalEnabled,
      dailyHostedLimit: ledger.hostedRunsRemaining || 0,
      fallbackReason: personalEnabled ? 'hosted-quota-exhausted' : 'high-resource-hosting-disabled',
    }
  }

  return {
    defaultExecutionMode: highLoadMode ? 'browser-local' : 'server-managed',
    resourceHeavyModeDefault: heavy ? 'server-managed' : 'server-managed',
    serverHighResourceHostingEnabled: personalEnabled,
    dailyHostedLimit: ledger.hostedRunsRemaining || 0,
    fallbackReason: highLoadMode ? 'server-high-load-degrade-after-current-task' : null,
  }
}

export function makeDispatchSnapshot(data: PublicServerData): DispatchSnapshot {
  const policy = data.siteSettings.dispatchPolicy
  const nodes = (policy?.nodes || [])
    .filter((node) => node.enabled !== false && node.url)
    .map((node) => ({ ...node, weight: Math.max(1, Number(node.weight) || 1) }))
  if (!policy?.enabled || nodes.length === 0) {
    return {
      strategy: 'round-robin-weighted',
      selectedNode: null,
      nodes,
      message: 'Dispatch is a planned-only balancing contract. Configure dispatchPolicy.nodes to preview multi-server routing.',
      plannedOnly: true,
      fallbackReason: policy?.enabled ? 'no-enabled-dispatch-nodes' : 'dispatch-disabled',
    }
  }
  const sortedNodes = [...nodes].sort((a, b) => ((a.currentLoad || 0) / a.weight) - ((b.currentLoad || 0) / b.weight))
  const expanded = sortedNodes.flatMap((node) => Array.from({ length: node.weight }, () => node))
  const selectedNode = expanded[Math.floor(Date.now() / 1000) % expanded.length] || nodes[0]
  return {
    strategy: 'round-robin-weighted',
    selectedNode,
    nodes,
    message: 'Planned-only dispatch preview selected a candidate node. Real queue execution can attach here later.',
    plannedOnly: true,
    fallbackReason: null,
  }
}

function isMeteredRoute(method: string, route: string) {
  if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') return false
  return /^\/api\/workflows\//.test(route)
    || route === '/api/remix/fetch'
    || route === '/api/assets/import'
    || route === '/api/works'
    || /^\/api\/works\/[^/]+\/(share|gallery-submit)$/.test(route)
}

export function enforceTrafficGuard(data: PublicServerData, request: FastifyRequest) {
  const route = request.url.split('?')[0]
  const method = request.method
  const ip = getClientIp(request)
  const now = Date.now()
  const blocked = ip
    ? data.blockedIps.find((item) => item.ip === ip && (!item.expiresAt || Date.parse(item.expiresAt) > now))
    : null
  if (blocked) {
    return { ok: false, statusCode: 403, error: `IP blocked: ${blocked.reason}` }
  }
  if (!isMeteredRoute(method, route)) return { ok: true }

  const actor = getActor(data, request)
  if (actor.tier === 'host-admin' || actor.tier === 'admin') return { ok: true }
  const subjectType = actor.tier === 'guest' ? 'ip' : 'user'
  const subject = actor.tier === 'guest' ? (ip || 'unknown-ip') : actor.id
  const policy = actor.tier === 'guest'
    ? data.rateLimitPolicies.find((item) => item.id === 'guest-ip-daily')
    : data.rateLimitPolicies.find((item) => item.id === 'user-hourly-basic')
  if (!policy?.enabled) return { ok: true }

  const cutoff = now - policy.windowSeconds * 1000
  data.rateLimitEvents = data.rateLimitEvents.filter((event) => Date.parse(event.createdAt) > now - RATE_EVENT_RETENTION_MS)
  const count = data.rateLimitEvents.filter((event) => (
    event.subject === subject
    && event.subjectType === subjectType
    && Date.parse(event.createdAt) >= cutoff
  )).length

  if (count >= policy.maxRequests) {
    if (policy.lockoutSeconds && ip) {
      data.blockedIps.push({
        ip,
        reason: `rate limit ${policy.id}`,
        blockedAt: new Date().toISOString(),
        expiresAt: new Date(now + policy.lockoutSeconds * 1000).toISOString(),
        createdBy: 'system',
      })
    }
    return { ok: false, statusCode: 429, error: `Rate limit exceeded (${policy.maxRequests}/${policy.windowSeconds}s).` }
  }

  data.rateLimitEvents.push({
    id: createId('rate'),
    subject,
    subjectType,
    route,
    tier: actor.tier,
    ip,
    createdAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function cleanupPublicServerData(data: PublicServerData) {
  const now = Date.now()
  const before = {
    workflows: data.workflows.length,
    rateLimitEvents: data.rateLimitEvents.length,
    blockedIps: data.blockedIps.length,
    sessions: data.sessions.length,
  }
  data.workflows = data.workflows.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > now)
  data.rateLimitEvents = data.rateLimitEvents.filter((item) => Date.parse(item.createdAt) > now - RATE_EVENT_RETENTION_MS)
  data.blockedIps = data.blockedIps.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > now)
  data.sessions = data.sessions.filter((item) => Date.parse(item.expiresAt) > now)
  return {
    workflows: before.workflows - data.workflows.length,
    rateLimitEvents: before.rateLimitEvents - data.rateLimitEvents.length,
    blockedIps: before.blockedIps - data.blockedIps.length,
    sessions: before.sessions - data.sessions.length,
  }
}

export function makeOpsSnapshot(data: PublicServerData) {
  const hostingPolicy = resolveHostingPolicy(data, {
    modeId: 'custom',
    actorId: 'local-admin',
    tier: 'host-admin',
  })
  return {
    takenAt: new Date().toISOString(),
    counts: {
      users: data.users.length,
      sessions: data.sessions.length,
      workflows: data.workflows.length,
      works: data.works.length,
      shareLinks: data.shareLinks.length,
      galleryEntries: data.galleryEntries.length,
      rateLimitEvents: data.rateLimitEvents.length,
      blockedIps: data.blockedIps.length,
    },
    hostingPolicy,
    storage: {
      adapter: 'local-json' as const,
      retentionHours: 24,
    },
    highLoadMode: data.siteSettings.securityMode === 'limited',
    dispatch: makeDispatchSnapshot(data),
  }
}

export function tierAtLeast(tier: UserTier, minimum: UserTier) {
  return TIER_RANK[tier] >= TIER_RANK[minimum]
}
