import type { FastifyInstance } from 'fastify'

export async function registerWorkflowRoutes(app: FastifyInstance) {
  app.post('/api/workflows/generate', async (request) => ({
    ok: true,
    route: 'generate',
    phase: 'phase-1-placeholder',
    received: request.body || null,
  }))

  app.post('/api/workflows/refine', async (request) => ({
    ok: true,
    route: 'refine',
    phase: 'phase-1-placeholder',
    received: request.body || null,
  }))

  app.post('/api/workflows/plan', async (request) => ({
    ok: true,
    route: 'plan',
    phase: 'phase-1-placeholder',
    received: request.body || null,
  }))
}
