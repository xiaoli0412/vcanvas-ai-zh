import type { FastifyInstance } from 'fastify'
import type { ModelCapability, ProviderChannel, UserTier } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { canManageModels, getActor, maskProviderChannels, resolveOwnedTargetId } from '../lib/platformPolicy'
import { encryptProviderApiKey, maskSecret } from '../lib/providerKeyVault'

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

function canEditChannel(actor: { id: string; tier: UserTier }, channel: ProviderChannel | undefined) {
  if (canManageModels(actor.tier)) return true
  return Boolean(channel?.ownerId && channel.ownerId === actor.id)
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

  app.post('/api/providers', async (request, reply) => {
    const body = (request.body || {}) as Partial<ProviderChannel> & {
      batchCapabilities?: CapabilityPatch[]
      apiKey?: string
      clearApiKey?: boolean
    }
    const now = new Date().toISOString()

    if (Array.isArray(body.batchCapabilities)) {
      const preflightData = await localDataStore.read()
      const preflightActor = getActor(preflightData, request)
      if (preflightActor.tier === 'guest') {
        reply.code(403)
        return { ok: false, error: 'Guest users cannot modify server-side provider channels.' }
      }
      const denied = (body.batchCapabilities || []).find((patch) => {
        const channel = preflightData.providerChannels.find((item) => item.id === patch.providerId)
        return !channel || !canEditChannel(preflightActor, channel)
      })
      if (denied) {
        reply.code(403)
        return { ok: false, error: 'Only channel owners or host-admin/admin can edit provider model capabilities.' }
      }
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
          ok: true,
          channels: maskProviderChannels(data.providerChannels, actor.tier, actor.id),
        }
      })
      return result
    }

    const preflightData = await localDataStore.read()
    const preflightActor = getActor(preflightData, request)
    if (preflightActor.tier === 'guest') {
      reply.code(403)
      return { ok: false, error: 'Guest users cannot save server-side provider channels. Use browser-local BYOK instead.' }
    }
    const id = body.id?.trim() || createId('provider')
    const preflightExisting = preflightData.providerChannels.find((item) => item.id === id)
    if (preflightExisting && !canEditChannel(preflightActor, preflightExisting)) {
      reply.code(403)
      return { ok: false, error: 'Only channel owners or host-admin/admin can edit this provider channel.' }
    }

    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const existing = data.providerChannels.find((item) => item.id === id)
      const ownerResolution = resolveOwnedTargetId(actor, body.ownerId)
      const ownerId = existing
        ? body.ownerId !== undefined
          ? ownerResolution.ownerId
          : existing.ownerId ?? null
        : ownerResolution.ownerId
      const encryptedKey = typeof body.apiKey === 'string' ? encryptProviderApiKey(body.apiKey) : undefined
      const next: ProviderChannel = {
        id,
        label: body.label?.trim() || existing?.label || id,
        endpoint: body.endpoint?.trim() || existing?.endpoint,
        apiType: body.apiType || existing?.apiType || 'openai-compatible',
        models: (body.models || existing?.models || []).map((model) => normalizeModel(model)),
        ownerId,
        apiKeyMasked: body.clearApiKey
          ? null
          : encryptedKey
            ? maskSecret(body.apiKey || '')
            : existing?.apiKeyMasked ?? null,
        apiKeyEncrypted: body.clearApiKey
          ? null
          : encryptedKey ?? existing?.apiKeyEncrypted ?? null,
        verifiedAt: body.verifiedAt ?? existing?.verifiedAt ?? null,
        verifiedSourceUrl: body.verifiedSourceUrl ?? existing?.verifiedSourceUrl ?? null,
        verificationMethod: body.verificationMethod ?? existing?.verificationMethod ?? null,
        verificationNotes: body.verificationNotes ?? existing?.verificationNotes ?? null,
        capabilityDetectionConfidence: body.capabilityDetectionConfidence ?? existing?.capabilityDetectionConfidence ?? 'unknown',
        lastModelFetchAt: body.lastModelFetchAt ?? existing?.lastModelFetchAt ?? null,
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
        metadata: {
          providerId: id,
          ownerId: next.ownerId,
          ownerResolution,
          keyCustody: next.apiKeyEncrypted ? 'encrypted-local' : next.apiKeyMasked ? 'masked-only' : 'none',
        },
      })
      return { ok: true, channel: maskProviderChannels([next], actor.tier, actor.id)[0] }
    })
    return { ok: true, channel: result.channel }
  })
}
