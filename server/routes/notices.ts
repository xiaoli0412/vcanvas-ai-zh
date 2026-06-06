import type { FastifyInstance } from 'fastify'
import type { NoticeMessage } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'

export async function registerNoticeRoutes(app: FastifyInstance) {
  app.get('/api/notices', async () => {
    const data = await localDataStore.read()
    const notices = data.notices.filter((notice) => notice.enabled)
    return {
      ok: true,
      notices,
      items: notices,
      allNotices: data.notices,
    }
  })

  app.post('/api/notices', async (request) => {
    const body = (request.body || {}) as Partial<NoticeMessage>
    const now = new Date().toISOString()
    const notice = await localDataStore.update((data) => {
      const id = body.id || createId('notice')
      const existing = data.notices.find((item) => item.id === id)
      const next: NoticeMessage = {
        id,
        kind: body.kind || existing?.kind || 'announcement',
        title: body.title || existing?.title || 'inscanvas notice',
        body: body.body || existing?.body || '',
        format: body.format || existing?.format || 'plain',
        audience: body.audience || existing?.audience || 'all',
        enabled: body.enabled ?? existing?.enabled ?? true,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }
      data.notices = [
        ...data.notices.filter((item) => item.id !== id),
        next,
      ]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: 'local-admin',
        actorTier: 'host-admin',
        action: existing ? 'notice.update' : 'notice.create',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { noticeId: id },
      })
      return next
    })
    return { ok: true, notice }
  })
}
