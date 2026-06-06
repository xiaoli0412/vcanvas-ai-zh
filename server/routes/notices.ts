import type { FastifyInstance } from 'fastify'
import type { NoticeMessage } from '../../shared/contracts/publicServer'

const notices: NoticeMessage[] = [
  {
    id: 'phase-1-public-server',
    kind: 'announcement',
    title: 'inscanvas public server phase 1',
    body: 'Public-server APIs are available as local/mock contracts while auth, quota, gallery, and ops are being wired in.',
    format: 'plain',
    audience: 'all',
    enabled: true,
    createdAt: new Date(0).toISOString(),
  },
]

export async function registerNoticeRoutes(app: FastifyInstance) {
  app.get('/api/notices', async () => ({
    ok: true,
    notices,
  }))

  app.post('/api/notices', async (request) => ({
    ok: true,
    phase: 'phase-1-notice-placeholder',
    received: request.body || null,
  }))
}
