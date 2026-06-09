import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { PersonalSettings, SiteSettings } from '../../shared/contracts/publicServer'
import { canManageSite, getActor } from '../lib/platformPolicy'

const defaultSharePolicy: NonNullable<SiteSettings['sharePolicy']> = {
  enabled: true,
  publicBaseUrl: '',
  pauseOnSecurityWarning: true,
}

const defaultNoticePolicy: NonNullable<SiteSettings['noticePolicy']> = {
  forceWarnings: true,
  allowMarkdown: true,
  allowImages: true,
}

const defaultUpdatePolicy: NonNullable<SiteSettings['updatePolicy']> = {
  githubRepo: 'xiaoli0412/vcanvas-ai-zh',
  checkEnabled: true,
  lowTrafficAutoUpdate: false,
}

const defaultMigrationPolicy: NonNullable<SiteSettings['migrationPolicy']> = {
  exportEnabled: true,
  requireVerification: true,
}

const defaultDispatchPolicy: NonNullable<SiteSettings['dispatchPolicy']> = {
  enabled: false,
  strategy: 'round-robin-weighted',
  nodes: [],
}

const tierKeys = ['host-admin', 'admin', 'vip', 'user', 'guest'] as const

function normalizeGalleryPublishLimits(value: unknown, fallback: SiteSettings['galleryPublishLimits']) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  const source = value as Record<string, unknown>
  const next = { ...(fallback || {}) }
  for (const tier of tierKeys) {
    if (!(tier in source)) continue
    const raw = source[tier]
    if (raw === null) {
      next[tier] = null
      continue
    }
    const numeric = Number(raw)
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error('galleryPublishLimits must contain non-negative numbers or null.')
    }
    next[tier] = Math.floor(numeric)
  }
  return next
}

function normalizeSiteSettingsBody(body: Partial<SiteSettings> & Record<string, unknown>, current: SiteSettings) {
  const next = { ...body }
  if ('workLimitPerOwner' in body) {
    const numeric = Number(body.workLimitPerOwner)
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error('workLimitPerOwner must be a non-negative number.')
    next.workLimitPerOwner = Math.floor(numeric)
  }
  if ('galleryPublishLimits' in body) {
    next.galleryPublishLimits = normalizeGalleryPublishLimits(body.galleryPublishLimits, current.galleryPublishLimits)
  }
  if ('highLoadDegradeThreshold' in body) {
    const numeric = Number(body.highLoadDegradeThreshold)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new Error('highLoadDegradeThreshold must be between 0 and 1.')
    next.highLoadDegradeThreshold = numeric
  }
  return next
}

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/site', async () => {
    const data = await localDataStore.read()
    const settings = {
      ...data.siteSettings,
      disclaimerPolicy: data.disclaimerPolicy,
      rateLimitPolicies: data.rateLimitPolicies,
    }
    return {
      ok: true,
      ...settings,
      settings,
    }
  })

  const updateSiteSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as Partial<SiteSettings> & Record<string, unknown>
    const current = await localDataStore.read()
    const currentActor = getActor(current, request)
    if (!canManageSite(currentActor.tier)) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can update inscanvas site settings.' })
      return
    }
    let normalizedBody: Partial<SiteSettings> & Record<string, unknown>
    try {
      normalizedBody = normalizeSiteSettingsBody(body, current.siteSettings)
    } catch (error: any) {
      reply.code(400).send({ ok: false, error: error.message || String(error) })
      return
    }
    const settings = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      data.siteSettings = {
        ...data.siteSettings,
        ...normalizedBody,
        sharePolicy: { ...defaultSharePolicy, ...(data.siteSettings.sharePolicy || {}), ...(normalizedBody.sharePolicy || {}) },
        noticePolicy: { ...defaultNoticePolicy, ...(data.siteSettings.noticePolicy || {}), ...(normalizedBody.noticePolicy || {}) },
        updatePolicy: { ...defaultUpdatePolicy, ...(data.siteSettings.updatePolicy || {}), ...(normalizedBody.updatePolicy || {}) },
        migrationPolicy: { ...defaultMigrationPolicy, ...(data.siteSettings.migrationPolicy || {}), ...(normalizedBody.migrationPolicy || {}) },
        dispatchPolicy: { ...defaultDispatchPolicy, ...(data.siteSettings.dispatchPolicy || {}), ...(normalizedBody.dispatchPolicy || {}) },
      }
      if (normalizedBody.disclaimerPolicy && typeof normalizedBody.disclaimerPolicy === 'object') {
        data.disclaimerPolicy = {
          ...data.disclaimerPolicy,
          ...(normalizedBody.disclaimerPolicy as Record<string, unknown>),
        }
      }
      if (Array.isArray(normalizedBody.rateLimitPolicies)) {
        data.rateLimitPolicies = normalizedBody.rateLimitPolicies as typeof data.rateLimitPolicies
      }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'settings.site.update',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
      })
      return data.siteSettings
    })
    return { ok: true, settings }
  }

  app.post('/api/settings/site', updateSiteSettings)
  app.patch('/api/settings/site', updateSiteSettings)

  app.get('/api/settings/personal', async () => {
    const data = await localDataStore.read()
    const settings = data.personalSettings
    return {
      ok: true,
      ...settings,
      settings,
    }
  })

  const updatePersonalSettings = async (request: FastifyRequest) => {
    const body = (request.body || {}) as Partial<PersonalSettings>
    const settings = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      data.personalSettings = {
        ...data.personalSettings,
        ...body,
        experimental: {
          ...data.personalSettings.experimental,
          ...body.experimental,
          serverHighResourceHosting: body.experimental?.serverHighResourceHosting
            ?? data.personalSettings.experimental?.serverHighResourceHosting
            ?? false,
        },
      }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'settings.personal.update',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
      })
      return data.personalSettings
    })
    return { ok: true, settings }
  }

  app.post('/api/settings/personal', updatePersonalSettings)
  app.patch('/api/settings/personal', updatePersonalSettings)
}
