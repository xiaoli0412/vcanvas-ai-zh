import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { PersonalSettings, SiteSettings } from '../../shared/contracts/publicServer'

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

  app.post('/api/settings/site', async (request) => {
    const body = (request.body || {}) as Partial<SiteSettings> & Record<string, unknown>
    const settings = await localDataStore.update((data) => {
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
        actorId: 'local-admin',
        actorTier: 'host-admin',
        action: 'settings.site.update',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
      })
      return data.siteSettings
    })
    return { ok: true, settings }
  })

  app.get('/api/settings/personal', async () => {
    const data = await localDataStore.read()
    const settings = data.personalSettings
    return {
      ok: true,
      ...settings,
      settings,
    }
  })

  app.post('/api/settings/personal', async (request) => {
    const body = (request.body || {}) as Partial<PersonalSettings>
    const settings = await localDataStore.update((data) => {
      data.personalSettings = {
        ...data.personalSettings,
        ...body,
      }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: 'local-user',
        actorTier: 'user',
        action: 'settings.personal.update',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
      })
      return data.personalSettings
    })
    return { ok: true, settings }
  })
}
