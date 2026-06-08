import type { FastifyInstance, FastifyRequest } from 'fastify'
import { localDataStore } from '../data/localDataStore'
import { getActor, getTierPermissions } from '../lib/platformPolicy'
import { checkGithubReleaseUpdate } from '../lib/updateChecker'

function canCheckUpdates(tier: ReturnType<typeof getActor>['tier']) {
  return getTierPermissions(tier).includes('manage-site') || tier === 'host-admin' || tier === 'admin'
}

export async function registerUpdateRoutes(app: FastifyInstance) {
  app.get('/api/updates/check', async (request: FastifyRequest, reply) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    if (!canCheckUpdates(actor.tier)) {
      return reply.code(403).send({ ok: false, error: 'Only host-admin/admin can check inscanvas update status.' })
    }
    const update = await checkGithubReleaseUpdate(data.siteSettings)
    return { ok: true, update }
  })
}
