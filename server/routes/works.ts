import type { FastifyInstance } from 'fastify'

export async function registerWorkRoutes(app: FastifyInstance) {
  app.get('/api/works', async () => ({
    ok: true,
    items: [],
    note: 'Phase 1 placeholder work listing.',
  }))

  app.post('/api/works', async (request) => ({
    ok: true,
    phase: 'phase-1-works-placeholder',
    work: {
      id: `work-${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...((request.body || {}) as Record<string, unknown>),
    },
    note: 'Works are not persisted until the PostgreSQL-backed phase lands.',
  }))

  app.get('/api/works/:id', async (request) => ({
    ok: true,
    id: (request.params as { id: string }).id,
    work: null,
    note: 'Phase 1 placeholder work lookup.',
  }))

  app.patch('/api/works/:id', async (request) => ({
    ok: true,
    id: (request.params as { id: string }).id,
    phase: 'phase-1-works-placeholder',
    received: request.body || null,
  }))

  app.delete('/api/works/:id', async (request) => ({
    ok: true,
    id: (request.params as { id: string }).id,
    phase: 'phase-1-works-placeholder',
  }))
}
