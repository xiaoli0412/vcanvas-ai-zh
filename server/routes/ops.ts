import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { cleanupPublicServerData, getActor, makeOpsSnapshot } from '../lib/platformPolicy'

export async function registerOpsRoutes(app: FastifyInstance) {
  app.get('/api/ops/status', async () => {
    const data = await localDataStore.read()
    return {
      ok: true,
      snapshot: makeOpsSnapshot(data),
    }
  })

  app.post('/api/maintenance/cleanup', async (request) => {
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const removed = cleanupPublicServerData(data)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'maintenance.cleanup',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: removed,
      })
      return {
        removed,
        snapshot: makeOpsSnapshot(data),
      }
    })
    return { ok: true, ...result }
  })
}
