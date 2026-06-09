import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { canManageUsers, cleanupPublicServerData, getActor, makeOpsSnapshot } from '../lib/platformPolicy'

function cleanupDenied(reply: any) {
  reply.code(403).send({ ok: false, error: 'Only host-admin/admin can run local maintenance cleanup.' })
}

export async function registerOpsRoutes(app: FastifyInstance) {
  app.get('/api/ops/status', async () => {
    const data = await localDataStore.read()
    return {
      ok: true,
      snapshot: makeOpsSnapshot(data),
    }
  })

  app.get('/api/maintenance/cleanup', async (request, reply) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    if (!canManageUsers(actor.tier)) {
      cleanupDenied(reply)
      return
    }
    return {
      ok: true,
      cleanup: cleanupPublicServerData(data, { dryRun: true }),
      snapshot: makeOpsSnapshot(data),
    }
  })

  app.post('/api/maintenance/cleanup', async (request, reply) => {
    const body = (request.body || {}) as { dryRun?: boolean }
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageUsers(actor.tier)) return { ok: false as const, statusCode: 403, error: 'Only host-admin/admin can run local maintenance cleanup.' }
      const cleanup = cleanupPublicServerData(data, { dryRun: body.dryRun === true })
      if (body.dryRun === true) {
        return {
          ok: true as const,
          cleanup,
          snapshot: makeOpsSnapshot(data),
        }
      }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'maintenance.cleanup',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: { cleanup },
      })
      return {
        ok: true as const,
        cleanup,
        removed: cleanup.removed,
        snapshot: makeOpsSnapshot(data),
      }
    })
    if (!result.ok) {
      reply.code(result.statusCode).send({ ok: false, error: result.error })
      return
    }
    return result
  })
}
