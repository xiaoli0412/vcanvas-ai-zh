import type { FastifyInstance } from 'fastify'
import type { ProviderChannel } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'

export async function registerProviderRoutes(app: FastifyInstance) {
  app.get('/api/providers', async () => {
    const data = await localDataStore.read()
    return {
      ok: true,
      channels: data.providerChannels,
      note: 'Model capability data is persisted locally; built-in model rows should only be added after official-doc or live /models verification.',
    }
  })

  app.post('/api/providers', async (request) => {
    const body = (request.body || {}) as Partial<ProviderChannel>
    const now = new Date().toISOString()
    const channel = await localDataStore.update((data) => {
      const id = body.id?.trim() || createId('provider')
      const existing = data.providerChannels.find((item) => item.id === id)
      const next: ProviderChannel = {
        id,
        label: body.label?.trim() || existing?.label || id,
        endpoint: body.endpoint?.trim() || existing?.endpoint,
        apiType: body.apiType || existing?.apiType || 'openai-compatible',
        models: body.models || existing?.models || [],
        verifiedAt: body.verifiedAt ?? existing?.verifiedAt ?? null,
        verifiedSourceUrl: body.verifiedSourceUrl ?? existing?.verifiedSourceUrl ?? null,
        favorite: body.favorite ?? existing?.favorite ?? false,
        enabled: body.enabled ?? existing?.enabled ?? true,
      }
      data.providerChannels = [
        ...data.providerChannels.filter((item) => item.id !== id),
        next,
      ]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: 'local-admin',
        actorTier: 'host-admin',
        action: existing ? 'provider.update' : 'provider.create',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { providerId: id },
      })
      return next
    })
    return { ok: true, channel }
  })
}
