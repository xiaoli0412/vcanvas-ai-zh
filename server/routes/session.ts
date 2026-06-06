import type { FastifyInstance } from 'fastify'

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get('/api/session/me', async () => ({
    ok: true,
    executionMode: 'browser-local',
    user: {
      id: 'guest-local',
      tier: 'guest',
      displayName: 'Guest',
    },
    note: 'Phase 1 placeholder session endpoint for public-server migration.',
  }))

  app.post('/api/session/login', async (request) => ({
    ok: true,
    phase: 'phase-1-auth-placeholder',
    executionMode: 'server-managed',
    user: {
      id: 'mock-user',
      tier: 'user',
      displayName: 'inscanvas user',
    },
    received: request.body || null,
    note: 'Login is mocked until the newapi/subapi bridges and encrypted sessions are connected.',
  }))

  app.post('/api/session/logout', async () => ({
    ok: true,
    phase: 'phase-1-auth-placeholder',
  }))

  app.post('/api/session/guest', async (request) => ({
    ok: true,
    phase: 'phase-1-auth-placeholder',
    executionMode: 'browser-local',
    user: {
      id: 'guest-local',
      tier: 'guest',
      displayName: 'Guest',
    },
    received: request.body || null,
  }))
}
