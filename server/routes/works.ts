import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { CanvasModeId, WorkRecord, WorkSnapshot } from '../../shared/contracts/publicServer'

const MAX_WORKS_PER_OWNER = 10

function injectDisclaimer(html: string | undefined, metadata: { ip?: string | null; time: string }) {
  if (!html) return html
  const note = `<!-- Generated with inscanvas | ip=${metadata.ip || 'unknown'} | time=${metadata.time} | review before publishing. -->`
  if (html.includes('Generated with inscanvas')) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${note}\n</body>`)
  return `${note}\n${html}`
}

export async function registerWorkRoutes(app: FastifyInstance) {
  app.get('/api/works', async (request) => {
    const ownerId = typeof request.query === 'object' && request.query && 'ownerId' in request.query
      ? String((request.query as { ownerId?: string }).ownerId || 'guest-local')
      : 'guest-local'
    const data = await localDataStore.read()
    return {
      ok: true,
      items: data.works.filter((work) => work.ownerId === ownerId),
      limit: MAX_WORKS_PER_OWNER,
    }
  })

  app.post('/api/works', async (request, reply) => {
    const body = (request.body || {}) as Partial<WorkRecord> & { canvasData?: string }
    const now = new Date().toISOString()
    const ownerId = body.ownerId || 'guest-local'
    const html = injectDisclaimer(body.html, { ip: getClientIp(request), time: now })
    const work = await localDataStore.update((data) => {
      const ownerWorks = data.works.filter((item) => item.ownerId === ownerId)
      if (ownerWorks.length >= MAX_WORKS_PER_OWNER) return null
      const id = body.id || createId('work')
      const snapshot: WorkSnapshot = {
        id: createId('snapshot'),
        workId: id,
        html,
        canvasData: body.canvasData,
        previewImageUrl: null,
        createdAt: now,
      }
      const next: WorkRecord = {
        id,
        ownerId,
        title: body.title?.slice(0, 50) || 'Untitled work',
        description: body.description?.slice(0, 50) || '',
        modeId: body.modeId || 'custom',
        status: body.status || 'draft',
        html,
        shareSlug: body.shareSlug || null,
        galleryStatus: body.galleryStatus || 'private',
        disclaimerInjectedAt: html ? now : null,
        createdAt: now,
        updatedAt: now,
        snapshots: [snapshot],
      }
      data.works.push(next)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: ownerId,
        actorTier: ownerId === 'guest-local' ? 'guest' : 'user',
        action: 'work.create',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workId: id },
      })
      return next
    })
    if (!work) {
      reply.code(409).send({
        ok: false,
        error: `Work limit reached (${MAX_WORKS_PER_OWNER}). Delete an existing work before saving a new one.`,
      })
      return
    }
    return { ok: true, work }
  })

  app.get('/api/works/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const data = await localDataStore.read()
    const work = data.works.find((item) => item.id === id)
    if (!work) {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    return { ok: true, work }
  })

  app.patch('/api/works/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const body = (request.body || {}) as Partial<WorkRecord> & { canvasData?: string }
    const now = new Date().toISOString()
    const work = await localDataStore.update((data) => {
      const index = data.works.findIndex((item) => item.id === id)
      if (index < 0) return null
      const current = data.works[index]
      const html = body.html ? injectDisclaimer(body.html, { ip: getClientIp(request), time: now }) : current.html
      const snapshots = body.html || body.canvasData
        ? [
          ...current.snapshots,
          {
            id: createId('snapshot'),
            workId: id,
            html,
            canvasData: body.canvasData,
            previewImageUrl: null,
            createdAt: now,
          },
        ]
        : current.snapshots
      const next: WorkRecord = {
        ...current,
        ...body,
        title: body.title?.slice(0, 50) || current.title,
        description: body.description?.slice(0, 50) ?? current.description,
        modeId: (body.modeId as CanvasModeId) || current.modeId,
        html,
        disclaimerInjectedAt: body.html ? now : current.disclaimerInjectedAt,
        updatedAt: now,
        snapshots,
      }
      data.works[index] = next
      data.auditEvents.push({
        id: createId('audit'),
        actorId: next.ownerId,
        actorTier: next.ownerId === 'guest-local' ? 'guest' : 'user',
        action: 'work.update',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workId: id },
      })
      return next
    })
    if (!work) {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    return { ok: true, work }
  })

  app.delete('/api/works/:id', async (request) => {
    const id = (request.params as { id: string }).id
    await localDataStore.update((data) => {
      const work = data.works.find((item) => item.id === id)
      data.works = data.works.filter((item) => item.id !== id)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: work?.ownerId || null,
        actorTier: work?.ownerId === 'guest-local' ? 'guest' : 'user',
        action: 'work.delete',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: { workId: id },
      })
    })
    return { ok: true, id }
  })
}
