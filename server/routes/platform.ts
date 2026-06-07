import type { FastifyInstance } from 'fastify'
import { localDataStore } from '../data/localDataStore'
import { makePlatformReadinessSnapshot } from '../lib/platformReadiness'

export async function registerPlatformRoutes(app: FastifyInstance) {
  app.get('/api/platform/readiness', async () => {
    const data = await localDataStore.read()
    return makePlatformReadinessSnapshot(data)
  })
}
