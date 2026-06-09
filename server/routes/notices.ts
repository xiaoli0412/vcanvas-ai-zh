import type { FastifyInstance } from 'fastify'
import type { NoticeMessage } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { canManageSite, getActor } from '../lib/platformPolicy'

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

  app.post('/api/notices', async (request, reply) => {
    const body = (request.body || {}) as Partial<NoticeMessage>
    const now = new Date().toISOString()
    const notice = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageSite(actor.tier)) return { status: 403 as const, notice: null, actor }
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
        force: body.force ?? existing?.force ?? body.kind === 'warning',
        dismissible: body.dismissible ?? existing?.dismissible ?? body.kind !== 'warning',
        imageUrl: body.imageUrl ?? existing?.imageUrl ?? null,
        expiresAt: body.expiresAt ?? existing?.expiresAt ?? null,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }
      data.notices = [
        ...data.notices.filter((item) => item.id !== id),
        next,
      ]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: existing ? 'notice.update' : 'notice.create',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { noticeId: id },
      })
      return { status: 200 as const, notice: next, actor }
    })
    if (notice.status === 403) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can create inscanvas notices.' })
      return
    }
    return { ok: true, notice: notice.notice }
  })
}
