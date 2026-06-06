import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createId, getClientIp, localDataStore, type PublicServerData } from '../data/localDataStore'
import type { CanvasModeId, WorkRecord, WorkSnapshot } from '../../shared/contracts/publicServer'
import {
  buildDisclaimerComment,
  canSubmitGallery,
  createGalleryEntry,
  getActor,
  injectDisclaimerComment,
  tierAtLeast,
} from '../lib/platformPolicy'

function createSnapshot(id: string, html: string | undefined, canvasData: string | undefined, previewImageUrl: string | null | undefined, now: string): WorkSnapshot {
  return {
    id: createId('snapshot'),
    workId: id,
    html,
    canvasData,
    previewImageUrl: previewImageUrl || null,
    createdAt: now,
  }
}

function canAccessWork(data: PublicServerData, request: FastifyRequest, work: WorkRecord) {
  const actor = getActor(data, request)
  return actor.id === work.ownerId || tierAtLeast(actor.tier, 'admin')
}

function buildWork(input: {
  data: PublicServerData
  request: FastifyRequest
  body: Partial<WorkRecord> & { canvasData?: string; previewImageUrl?: string | null }
  ownerId: string
  now: string
}) {
  const id = input.body.id || createId('work')
  const comment = buildDisclaimerComment(input.data.disclaimerPolicy, {
    ip: getClientIp(input.request),
    time: input.now,
    action: 'save',
  })
  const html = injectDisclaimerComment(input.body.html, comment)
  const snapshot = createSnapshot(id, html, input.body.canvasData, input.body.previewImageUrl, input.now)
  return {
    id,
    ownerId: input.ownerId,
    title: input.body.title?.slice(0, 50) || '未命名作品',
    description: input.body.description?.slice(0, 50) || '',
    modeId: input.body.modeId || 'custom',
    status: input.body.status || 'saved',
    html,
    shareSlug: input.body.shareSlug || null,
    galleryStatus: input.body.galleryStatus || 'private',
    exportMetadata: {
      exportedAt: null,
      includesFlowMap: false,
      disclaimerComment: comment,
    },
    disclaimerInjectedAt: html ? input.now : null,
    createdAt: input.now,
    updatedAt: input.now,
    snapshots: [snapshot],
  } satisfies WorkRecord
}

export async function registerWorkRoutes(app: FastifyInstance) {
  app.get('/api/works', async (request) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    const ownerId = typeof request.query === 'object' && request.query && 'ownerId' in request.query
      ? String((request.query as { ownerId?: string }).ownerId || actor.id)
      : actor.id
    const limit = data.siteSettings.workLimitPerOwner || 10
    const items = data.works.filter((work) => work.ownerId === ownerId)
    return {
      ok: true,
      items,
      limit,
      shareLinks: data.shareLinks.filter((link) => items.some((work) => work.id === link.workId)),
    }
  })

  app.post('/api/works', async (request, reply) => {
    const body = (request.body || {}) as Partial<WorkRecord> & { canvasData?: string; previewImageUrl?: string | null }
    const now = new Date().toISOString()
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const ownerId = body.ownerId || actor.id
      const limit = data.siteSettings.workLimitPerOwner || 10
      const ownerWorks = data.works.filter((item) => item.ownerId === ownerId)
      if (ownerWorks.length >= limit) return { work: null, limit }
      const work = buildWork({ data, request, body, ownerId, now })
      data.works.push(work)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: ownerId,
        actorTier: actor.tier,
        action: 'work.create',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workId: work.id },
      })
      return { work, limit }
    })
    if (!result.work) {
      reply.code(409).send({
        ok: false,
        error: `Work limit reached (${result.limit}). Delete an existing work before saving a new one.`,
      })
      return
    }
    return { ok: true, work: result.work }
  })

  app.post('/api/works/import-html', async (request, reply) => {
    const body = (request.body || {}) as Partial<WorkRecord> & { canvasData?: string; html?: string; previewImageUrl?: string | null }
    if (!body.html?.trim()) {
      reply.code(400).send({ ok: false, error: 'Missing HTML content.' })
      return
    }
    const now = new Date().toISOString()
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const ownerId = body.ownerId || actor.id
      const limit = data.siteSettings.workLimitPerOwner || 10
      if (data.works.filter((item) => item.ownerId === ownerId).length >= limit) return { work: null, limit }
      const work = buildWork({
        data,
        request,
        body: { ...body, title: body.title || '导入 HTML', status: 'saved' },
        ownerId,
        now,
      })
      data.works.push(work)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: ownerId,
        actorTier: actor.tier,
        action: 'work.importHtml',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workId: work.id },
      })
      return { work, limit }
    })
    if (!result.work) {
      reply.code(409).send({ ok: false, error: `Work limit reached (${result.limit}).` })
      return
    }
    return { ok: true, work: result.work }
  })

  app.get('/api/works/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const data = await localDataStore.read()
    const work = data.works.find((item) => item.id === id)
    if (!work || !canAccessWork(data, request, work)) {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    return {
      ok: true,
      work,
      shareLinks: data.shareLinks.filter((link) => link.workId === id),
      galleryEntry: data.galleryEntries.find((entry) => entry.workId === id) || null,
    }
  })

  app.patch('/api/works/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const body = (request.body || {}) as Partial<WorkRecord> & { canvasData?: string; previewImageUrl?: string | null }
    const now = new Date().toISOString()
    const work = await localDataStore.update((data) => {
      const index = data.works.findIndex((item) => item.id === id)
      if (index < 0 || !canAccessWork(data, request, data.works[index])) return null
      const actor = getActor(data, request)
      const current = data.works[index]
      const comment = buildDisclaimerComment(data.disclaimerPolicy, {
        ip: getClientIp(request),
        time: now,
        action: 'save',
      })
      const html = body.html ? injectDisclaimerComment(body.html, comment) : current.html
      const snapshots = body.html || body.canvasData
        ? [...current.snapshots, createSnapshot(id, html, body.canvasData, body.previewImageUrl, now)]
        : current.snapshots
      const next: WorkRecord = {
        ...current,
        ...body,
        title: body.title?.slice(0, 50) || current.title,
        description: body.description?.slice(0, 50) ?? current.description,
        modeId: (body.modeId as CanvasModeId) || current.modeId,
        html,
        exportMetadata: {
          ...current.exportMetadata,
          ...body.exportMetadata,
          disclaimerComment: body.html ? comment : current.exportMetadata?.disclaimerComment,
        },
        disclaimerInjectedAt: body.html ? now : current.disclaimerInjectedAt,
        updatedAt: now,
        snapshots,
      }
      data.works[index] = next
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
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
      if (!work || !canAccessWork(data, request, work)) return
      const actor = getActor(data, request)
      data.works = data.works.filter((item) => item.id !== id)
      data.shareLinks = data.shareLinks.filter((item) => item.workId !== id)
      data.galleryEntries = data.galleryEntries.filter((item) => item.workId !== id)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'work.delete',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: { workId: id },
      })
    })
    return { ok: true, id }
  })

  app.post('/api/works/:id/share', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const result = await localDataStore.update((data) => {
      const work = data.works.find((item) => item.id === id)
      if (!work || !canAccessWork(data, request, work)) return null
      const actor = getActor(data, request)
      const now = new Date().toISOString()
      const comment = buildDisclaimerComment(data.disclaimerPolicy, {
        ip: getClientIp(request),
        time: now,
        action: 'share',
      })
      const slug = work.shareSlug || `${id}-${Math.random().toString(36).slice(2, 7)}`
      work.shareSlug = slug
      work.html = injectDisclaimerComment(work.html, comment)
      work.exportMetadata = {
        ...work.exportMetadata,
        exportedAt: now,
        disclaimerComment: comment,
      }
      work.updatedAt = now
      const link = {
        id: createId('share'),
        workId: id,
        ownerId: work.ownerId,
        slug,
        enabled: true,
        createdAt: now,
        expiresAt: null,
        disclaimerComment: comment,
      }
      data.shareLinks = [...data.shareLinks.filter((item) => item.workId !== id), link]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'work.share',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workId: id, slug },
      })
      return { work, link }
    })
    if (!result) {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    return { ok: true, ...result }
  })

  app.post('/api/works/:id/gallery-submit', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const result = await localDataStore.update((data) => {
      const work = data.works.find((item) => item.id === id)
      if (!work || !canAccessWork(data, request, work)) return { status: 'missing' as const }
      const actor = getActor(data, request)
      const eligibility = canSubmitGallery(data, actor.id, actor.tier)
      if (!eligibility.ok) return { status: 'denied' as const, eligibility }
      const entry = createGalleryEntry({ workId: id, ownerId: work.ownerId })
      work.galleryStatus = 'pending-review'
      data.galleryEntries = [...data.galleryEntries.filter((item) => item.workId !== id), entry]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'work.gallerySubmit',
        ip: getClientIp(request),
        createdAt: entry.submittedAt,
        metadata: { workId: id, galleryEntryId: entry.id },
      })
      return { status: 'ok' as const, entry, work, eligibility }
    })
    if (result.status === 'missing') {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    if (result.status === 'denied') {
      reply.code(403).send({ ok: false, error: result.eligibility.reason, limit: result.eligibility.limit })
      return
    }
    return { ok: true, entry: result.entry, work: result.work, limit: result.eligibility.limit }
  })

  app.get('/api/gallery', async () => {
    const data = await localDataStore.read()
    const entries = data.galleryEntries
      .filter((entry) => entry.status === 'published' || entry.status === 'pending-review')
      .map((entry) => ({
        ...entry,
        work: data.works.find((work) => work.id === entry.workId) || null,
      }))
    return {
      ok: true,
      enabled: data.siteSettings.publicGalleryEnabled,
      entries,
      items: entries,
    }
  })
}
