import type { FastifyInstance } from 'fastify'
import type { AssetImportKind, AssetImportResult, CanvasModeId } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { getActor, resolveHostingPolicy, resolveOwnedTargetId } from '../lib/platformPolicy'

function normalizeKind(value: unknown): AssetImportKind {
  if (value === 'image' || value === 'video' || value === 'html' || value === 'web-embed') return value
  return 'other'
}

function normalizeByteLength(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.round(numeric)
}

export async function registerAssetRoutes(app: FastifyInstance) {
  app.post('/api/assets/import', async (request) => {
    const body = (request.body || {}) as {
      kind?: AssetImportKind
      fileName?: string
      mimeType?: string
      byteLength?: number
      size?: number
      ownerId?: string
      modeId?: CanvasModeId
    }
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const kind = normalizeKind(body.kind)
      const ownerResolution = resolveOwnedTargetId(actor, body.ownerId)
      const ownerId = ownerResolution.ownerId
      const modeId = body.modeId || (kind === 'video' ? 'video' : 'custom')
      const hostingPolicy = resolveHostingPolicy(data, {
        modeId,
        actorId: ownerId,
        tier: actor.tier,
      })
      const heavy = kind === 'video'
      const executionMode = heavy ? hostingPolicy.resourceHeavyModeDefault : hostingPolicy.defaultExecutionMode
      const importResult: AssetImportResult = {
        id: createId('asset'),
        kind,
        fileName: body.fileName?.slice(0, 180) || null,
        mimeType: body.mimeType?.slice(0, 120) || null,
        byteLength: normalizeByteLength(body.byteLength ?? body.size),
        ownerId,
        executionMode,
        storage: 'metadata-only',
        accepted: true,
        reason: heavy && executionMode === 'browser-local'
          ? 'video assets stay client-side unless high-resource hosting and quota allow server-managed handling'
          : 'asset metadata accepted; binary storage is not enabled in local-json mode',
        createdAt: new Date().toISOString(),
      }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'asset.import',
        ip: getClientIp(request),
        createdAt: importResult.createdAt,
        metadata: {
          ownerId,
          ownerResolution: {
            requestedOwnerId: ownerResolution.requestedOwnerId,
            ownerOverrideAccepted: ownerResolution.ownerOverrideAccepted,
          },
          asset: importResult,
        },
      })
      return importResult
    })

    return {
      ok: true,
      route: 'assets/import',
      asset: result,
      phase: 'metadata-only-v1',
    }
  })
}
