import type { FastifyInstance } from 'fastify'

export async function registerAssetRoutes(app: FastifyInstance) {
  app.post('/api/assets/import', async (request) => ({
    ok: true,
    route: 'assets/import',
    phase: 'phase-1-placeholder',
    received: request.body || null,
  }))
}
