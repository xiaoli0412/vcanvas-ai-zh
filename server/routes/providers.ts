import type { FastifyInstance } from 'fastify'
import type { ModelCapability, ProviderChannel } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { getActor, maskProviderChannels } from '../lib/platformPolicy'

interface CapabilityPatch {
  providerId: string
  modelId: string
  capability: Partial<ModelCapability>
}

function normalizeModel(model: Partial<ModelCapability> & { id: string }): ModelCapability {
  return {
    id: model.id,
    label: model.label || model.id,
    source: model.source || 'manual',
    vision: model.vision ?? false,
    video: model.video ?? false,
    toolCalling: model.toolCalling ?? false,
    contextWindow: model.contextWindow,
    favorite: model.favorite ?? false,
    verifiedAt: model.verifiedAt ?? null,
    verifiedSourceUrl: model.verifiedSourceUrl ?? null,
    serverSide: model.serverSide ?? true,
  }
}

function applyCapabilityPatch(channel: ProviderChannel, patch: CapabilityPatch) {
  const existing = channel.models.find((model) => model.id === patch.modelId)
  const next = normalizeModel({
    ...(existing || { id: patch.modelId, source: 'manual' as const }),
    ...patch.capability,
    id: patch.modelId,
  })
  channel.models = [
    ...channel.models.filter((model) => model.id !== patch.modelId),
    next,
  ]
  if (next.favorite) {
    channel.favoriteModelIds = [...new Set([...(channel.favoriteModelIds || []), next.id])]
  } else {
    channel.favoriteModelIds = (channel.favoriteModelIds || []).filter((id) => id !== next.id)
  }
}

export async function registerProviderRoutes(app: FastifyInstance) {
  app.get('/api/providers', async (request) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    return {
      ok: true,
      channels: maskProviderChannels(data.providerChannels, actor.tier, actor.id),
      actor: { id: actor.id, tier: actor.tier },
      note: 'Model capability data is persisted locally; built-in model rows should only be added after official-doc or live /models verification.',
    }
  })

  app.post('/api/providers', async (request) => {
    const body = (request.body || {}) as Partial<ProviderChannel> & {
      batchCapabilities?: CapabilityPatch[]
    }
    const now = new Date().toISOString()

    if (Array.isArray(body.batchCapabilities)) {
      const result = await localDataStore.update((data) => {
        const actor = getActor(data, request)
        for (const patch of body.batchCapabilities || []) {
          const channel = data.providerChannels.find((item) => item.id === patch.providerId)
          if (!channel) continue
          applyCapabilityPatch(channel, patch)
        }
        data.auditEvents.push({
          id: createId('audit'),
          actorId: actor.id,
          actorTier: actor.tier,
          action: 'provider.batchCapabilities.update',
          ip: getClientIp(request),
          createdAt: now,
          metadata: { count: body.batchCapabilities?.length || 0 },
        })
        return {
          channels: maskProviderChannels(data.providerChannels, actor.tier, actor.id),
        }
      })
      return { ok: true, ...result }
    }

    const channel = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const id = body.id?.trim() || createId('provider')
      const existing = data.providerChannels.find((item) => item.id === id)
      const next: ProviderChannel = {
        id,
        label: body.label?.trim() || existing?.label || id,
        endpoint: body.endpoint?.trim() || existing?.endpoint,
        apiType: body.apiType || existing?.apiType || 'openai-compatible',
        models: (body.models || existing?.models || []).map((model) => normalizeModel(model)),
        ownerId: body.ownerId ?? existing?.ownerId ?? actor.id,
        apiKeyMasked: body.apiKeyMasked ?? existing?.apiKeyMasked ?? null,
        verifiedAt: body.verifiedAt ?? existing?.verifiedAt ?? null,
        verifiedSourceUrl: body.verifiedSourceUrl ?? existing?.verifiedSourceUrl ?? null,
        verificationMethod: body.verificationMethod ?? existing?.verificationMethod ?? null,
        favoriteModelIds: body.favoriteModelIds ?? existing?.favoriteModelIds ?? [],
        favorite: body.favorite ?? existing?.favorite ?? false,
        enabled: body.enabled ?? existing?.enabled ?? true,
      }
      data.providerChannels = [
        ...data.providerChannels.filter((item) => item.id !== id),
        next,
      ]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: existing ? 'provider.update' : 'provider.create',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { providerId: id },
      })
      return maskProviderChannels([next], actor.tier, actor.id)[0]
    })
    return { ok: true, channel }
  })
}
