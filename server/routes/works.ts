import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createId, getClientIp, localDataStore, type PublicServerData } from '../data/localDataStore'
import type { CanvasModeId, GalleryReviewStatus, WorkRecord, WorkSnapshot } from '../../shared/contracts/publicServer'
import { buildWorkSafetyReview } from '../lib/gallerySafety'
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

function canManageGallery(data: PublicServerData, request: FastifyRequest) {
  const actor = getActor(data, request)
  return {
    actor,
    allowed: tierAtLeast(actor.tier, 'admin'),
  }
}

function normalizeGalleryReviewStatus(value: unknown): GalleryReviewStatus | null {
  if (value === 'published' || value === 'rejected' || value === 'pending-review') return value
  return null
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
  const work: WorkRecord = {
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
  }
  work.safetyReview = buildWorkSafetyReview(work, input.now)
  work.exportMetadata = {
    ...work.exportMetadata,
    safetyStatus: work.safetyReview.status,
  }
  return work
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
      const contentChanged = body.title !== undefined || body.description !== undefined || body.html !== undefined
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
      let gallerySafetyStatus: string | null = null
      let galleryStatusAfterUpdate = next.galleryStatus
      if (contentChanged) {
        next.safetyReview = buildWorkSafetyReview(next, now)
        next.exportMetadata = {
          ...next.exportMetadata,
          safetyStatus: next.safetyReview.status,
        }
        if (next.safetyReview.status === 'blocked') {
          data.shareLinks = data.shareLinks.map((link) => link.workId === id
            ? { ...link, enabled: false, safetyReview: next.safetyReview }
            : link)
        }
        const galleryEntry = data.galleryEntries.find((entry) => entry.workId === id)
        if (galleryEntry) {
          galleryEntry.safetyReview = next.safetyReview
          gallerySafetyStatus = galleryEntry.safetyReview.status
          if (galleryEntry.status === 'published' && galleryEntry.safetyReview.status !== 'passed') {
            galleryEntry.status = 'pending-review'
            galleryEntry.reviewedAt = null
            galleryEntry.reviewerId = null
            galleryEntry.rejectionReason = null
          }
          galleryStatusAfterUpdate = galleryEntry.status
          next.galleryStatus = galleryEntry.status
        }
      }
      data.works[index] = next
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'work.update',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workId: id, workSafetyStatus: next.safetyReview?.status || null, gallerySafetyStatus, galleryStatusAfterUpdate },
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
      const safetyReview = buildWorkSafetyReview(work, now)
      work.safetyReview = safetyReview
      work.exportMetadata = {
        ...work.exportMetadata,
        safetyStatus: safetyReview.status,
      }
      if (safetyReview.status === 'blocked') {
        data.shareLinks = data.shareLinks.map((link) => link.workId === id ? { ...link, enabled: false, safetyReview } : link)
        data.auditEvents.push({
          id: createId('audit'),
          actorId: actor.id,
          actorTier: actor.tier,
          action: 'work.shareBlocked',
          ip: getClientIp(request),
          createdAt: now,
          metadata: { workId: id, safetyReview },
        })
        return { status: 'blocked' as const, work, safetyReview }
      }
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
        safetyReview,
      }
      data.shareLinks = [...data.shareLinks.filter((item) => item.workId !== id), link]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'work.share',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workId: id, slug, safetyStatus: safetyReview.status },
      })
      return { status: 'ok' as const, work, link, safetyReview }
    })
    if (!result) {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    if (result.status === 'blocked') {
      reply.code(409).send({
        ok: false,
        error: 'Work safety review blocked public sharing.',
        work: result.work,
        safetyReview: result.safetyReview,
      })
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
      entry.safetyReview = buildWorkSafetyReview(work, entry.submittedAt)
      work.safetyReview = entry.safetyReview
      work.exportMetadata = { ...work.exportMetadata, safetyStatus: entry.safetyReview.status }
      work.galleryStatus = 'pending-review'
      data.galleryEntries = [...data.galleryEntries.filter((item) => item.workId !== id), entry]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'work.gallerySubmit',
        ip: getClientIp(request),
        createdAt: entry.submittedAt,
        metadata: { workId: id, galleryEntryId: entry.id, safetyStatus: entry.safetyReview.status },
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

  app.get('/api/gallery', async (request) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    const query = (request.query || {}) as { includeReview?: string; includeOwn?: string }
    const includeReview = query.includeReview === 'true' && tierAtLeast(actor.tier, 'admin')
    const includeOwn = query.includeOwn === 'true'
    const entries = data.galleryEntries
      .filter((entry) => includeReview || entry.status === 'published' || (includeOwn && entry.ownerId === actor.id))
      .sort((a, b) => {
        const rank = { 'pending-review': 0, published: 1, rejected: 2 }
        return rank[a.status] - rank[b.status] || Date.parse(b.submittedAt) - Date.parse(a.submittedAt)
      })
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

  app.patch('/api/gallery/:id/review', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const body = (request.body || {}) as { status?: unknown; rejectionReason?: string | null }
    const status = normalizeGalleryReviewStatus(body.status)
    if (!status) {
      reply.code(400).send({ ok: false, error: 'Invalid gallery review status.' })
      return
    }

    const result = await localDataStore.update((data) => {
      const { actor, allowed } = canManageGallery(data, request)
      if (!allowed) return { status: 'forbidden' as const }
      const entry = data.galleryEntries.find((item) => item.id === id)
      if (!entry) return { status: 'missing' as const }
      const now = new Date().toISOString()
      const work = data.works.find((item) => item.id === entry.workId) || null
      const safetyReview = buildWorkSafetyReview(work, now)
      entry.safetyReview = safetyReview
      if (work) {
        work.safetyReview = safetyReview
        work.exportMetadata = { ...work.exportMetadata, safetyStatus: safetyReview.status }
      }
      if (status === 'published' && safetyReview.status === 'blocked') {
        data.auditEvents.push({
          id: createId('audit'),
          actorId: actor.id,
          actorTier: actor.tier,
          action: 'gallery.reviewBlocked',
          ip: getClientIp(request),
          createdAt: now,
          metadata: { galleryEntryId: entry.id, workId: entry.workId, safetyReview },
        })
        return { status: 'blocked' as const, entry, work, safetyReview }
      }
      entry.status = status
      entry.reviewedAt = now
      entry.reviewerId = actor.id
      entry.rejectionReason = status === 'rejected'
        ? (body.rejectionReason?.trim().slice(0, 160) || 'Rejected by gallery reviewer.')
        : null
      if (work) {
        work.galleryStatus = status
        work.updatedAt = now
      }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'gallery.review',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { galleryEntryId: entry.id, workId: entry.workId, status },
      })
      return { status: 'ok' as const, entry, work }
    })

    if (result.status === 'forbidden') {
      reply.code(403).send({ ok: false, error: 'Admin permission required for gallery review.' })
      return
    }
    if (result.status === 'missing') {
      reply.code(404).send({ ok: false, error: 'Gallery entry not found.' })
      return
    }
    if (result.status === 'blocked') {
      reply.code(409).send({
        ok: false,
        error: 'Gallery safety review blocked publishing.',
        entry: result.entry,
        work: result.work,
        safetyReview: result.safetyReview,
      })
      return
    }
    return { ok: true, entry: result.entry, work: result.work }
  })

  app.post('/api/gallery/:id/safety-review', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const result = await localDataStore.update((data) => {
      const { actor, allowed } = canManageGallery(data, request)
      if (!allowed) return { status: 'forbidden' as const }
      const entry = data.galleryEntries.find((item) => item.id === id)
      if (!entry) return { status: 'missing' as const }
      const work = data.works.find((item) => item.id === entry.workId) || null
      const safetyReview = buildWorkSafetyReview(work)
      entry.safetyReview = safetyReview
      if (work) {
        work.safetyReview = safetyReview
        work.exportMetadata = { ...work.exportMetadata, safetyStatus: safetyReview.status }
      }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'gallery.safetyReview',
        ip: getClientIp(request),
        createdAt: safetyReview.checkedAt,
        metadata: { galleryEntryId: entry.id, workId: entry.workId, safetyReview },
      })
      return { status: 'ok' as const, entry, work, safetyReview }
    })
    if (result.status === 'forbidden') {
      reply.code(403).send({ ok: false, error: 'Admin permission required for gallery safety review.' })
      return
    }
    if (result.status === 'missing') {
      reply.code(404).send({ ok: false, error: 'Gallery entry not found.' })
      return
    }
    return { ok: true, entry: result.entry, work: result.work, safetyReview: result.safetyReview }
  })
}
