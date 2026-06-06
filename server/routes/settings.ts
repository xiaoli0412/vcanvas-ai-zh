import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { PersonalSettings, SiteSettings } from '../../shared/contracts/publicServer'
import { getActor } from '../lib/platformPolicy'

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

  const updateSiteSettings = async (request: FastifyRequest) => {
    const body = (request.body || {}) as Partial<SiteSettings> & Record<string, unknown>
    const settings = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      data.siteSettings = {
        ...data.siteSettings,
        ...body,
      }
      if (body.disclaimerPolicy && typeof body.disclaimerPolicy === 'object') {
        data.disclaimerPolicy = {
          ...data.disclaimerPolicy,
          ...(body.disclaimerPolicy as Record<string, unknown>),
        }
      }
      if (Array.isArray(body.rateLimitPolicies)) {
        data.rateLimitPolicies = body.rateLimitPolicies as typeof data.rateLimitPolicies
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
