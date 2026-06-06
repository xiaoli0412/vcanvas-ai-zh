import type { FastifyInstance } from 'fastify'
import { localDataStore } from '../data/localDataStore'
import { makeDispatchSnapshot } from '../lib/platformPolicy'

export async function registerDispatchRoutes(app: FastifyInstance) {
  app.get('/api/dispatch/status', async () => {
    const data = await localDataStore.read()
    return {
      ok: true,
      dispatch: makeDispatchSnapshot(data),
    }
  })

  app.post('/api/dispatch/route', async () => {
    const data = await localDataStore.read()
    return {
      ok: true,
      dispatch: makeDispatchSnapshot(data),
    }
  })
}
