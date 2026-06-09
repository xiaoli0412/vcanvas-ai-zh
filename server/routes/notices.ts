import type { FastifyInstance } from 'fastify'
import type { NoticeMessage, UserTier } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { canManageSite, getActor } from '../lib/platformPolicy'

function noticeVisibleTo(notice: NoticeMessage, tier: UserTier, now = Date.now()) {
  if (!notice.enabled) return false
  if (notice.expiresAt) {
    const expiresAt = Date.parse(notice.expiresAt)
    if (Number.isFinite(expiresAt) && expiresAt <= now) return false
    if (!Number.isFinite(expiresAt)) return false
  }
  if (notice.audience === 'all') return true
  return Array.isArray(notice.audience) && notice.audience.includes(tier)
}

export async function registerNoticeRoutes(app: FastifyInstance) {
  app.get('/api/notices', async (request) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    const admin = canManageSite(actor.tier)
    const notices = data.notices.filter((notice) => noticeVisibleTo(notice, actor.tier))
    return {
      ok: true,
      notices,
      items: notices,
      allNotices: admin ? data.notices : undefined,
      actor: { id: actor.id, tier: actor.tier },
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

  app.patch('/api/notices/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const body = (request.body || {}) as Partial<NoticeMessage>
    const now = new Date().toISOString()
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageSite(actor.tier)) return { status: 403 as const, notice: null }
      const existing = data.notices.find((item) => item.id === id)
      if (!existing) return { status: 404 as const, notice: null }
      const notice: NoticeMessage = {
        ...existing,
        ...body,
        id: existing.id,
        updatedAt: now,
      }
      data.notices = data.notices.map((item) => item.id === id ? notice : item)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'notice.update',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { noticeId: id, enabled: notice.enabled },
      })
      return { status: 200 as const, notice }
    })
    if (result.status === 403) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can update inscanvas notices.' })
      return
    }
    if (result.status === 404) {
      reply.code(404).send({ ok: false, error: 'Notice not found.' })
      return
    }
    return { ok: true, notice: result.notice }
  })

  app.delete('/api/notices/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageSite(actor.tier)) return { status: 403 as const, removed: 0 }
      const before = data.notices.length
      data.notices = data.notices.filter((item) => item.id !== id)
      const removed = before - data.notices.length
      if (!removed) return { status: 404 as const, removed }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'notice.delete',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: { noticeId: id, removed },
      })
      return { status: 200 as const, removed }
    })
    if (result.status === 403) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can delete inscanvas notices.' })
      return
    }
    if (result.status === 404) {
      reply.code(404).send({ ok: false, error: 'Notice not found.' })
      return
    }
    return { ok: true, removed: result.removed }
  })
}
