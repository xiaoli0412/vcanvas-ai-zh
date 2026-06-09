import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createId, getClientIp, localDataStore, type PublicServerData } from '../data/localDataStore'
import type { CanvasModeId, GalleryEntry, GalleryReviewStatus, ShareLink, WorkRecord, WorkSafetyReview, WorkSnapshot } from '../../shared/contracts/publicServer'
import { buildWorkSafetyReview } from '../lib/gallerySafety'
import {
  buildDisclaimerComment,
  buildWorkGalleryQuotaSummary,
  canSubmitGallery,
  createGalleryEntry,
  getActor,
  resolveOwnedTargetId,
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

function isBlockedSafety(input: WorkRecord | { safetyReview?: WorkSafetyReview | null; exportMetadata?: { safetyStatus?: string } } | null | undefined) {
  return input?.safetyReview?.status === 'blocked' || input?.exportMetadata?.safetyStatus === 'blocked'
}

function isShareExpired(link: ShareLink | null | undefined) {
  return Boolean(link?.expiresAt && Date.parse(link.expiresAt) <= Date.now())
}

function findSafePublicShare(data: PublicServerData, work: WorkRecord | null | undefined) {
  if (!work || isBlockedSafety(work)) return null
  return data.shareLinks.find((link) => (
    link.workId === work.id
    && link.enabled
    && !isShareExpired(link)
    && !isBlockedSafety(link)
  )) || null
}

function isPublicGalleryEntry(data: PublicServerData, entry: GalleryEntry) {
  if (entry.status !== 'published' || isBlockedSafety(entry)) return false
  const work = data.works.find((item) => item.id === entry.workId) || null
  return Boolean(work && findSafePublicShare(data, work))
}

function applyBlockedWorkPublicSafety(data: PublicServerData, workId: string, safetyReview: WorkSafetyReview) {
  if (safetyReview.status !== 'blocked') return { disabledShareLinks: 0, demotedGallery: false, demotedGalleryEntries: 0 }
  let disabledShareLinks = 0
  data.shareLinks = data.shareLinks.map((link) => {
    if (link.workId !== workId) return link
    if (link.enabled) disabledShareLinks += 1
    return { ...link, enabled: false, safetyReview }
  })
  const entries = data.galleryEntries.filter((item) => item.workId === workId)
  let demotedGalleryEntries = 0
  for (const entry of entries) {
    entry.safetyReview = safetyReview
    if (entry.status === 'published') {
      entry.status = 'pending-review'
      entry.reviewedAt = null
      entry.reviewerId = null
      entry.rejectionReason = null
      demotedGalleryEntries += 1
    }
  }
  const work = data.works.find((item) => item.id === workId)
  if (work) {
    work.safetyReview = safetyReview
    work.exportMetadata = { ...work.exportMetadata, safetyStatus: safetyReview.status }
    const entry = entries[0]
    if (entry) work.galleryStatus = entry.status
  }
  return { disabledShareLinks, demotedGallery: demotedGalleryEntries > 0, demotedGalleryEntries }
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
    const requestedOwnerId = typeof request.query === 'object' && request.query && 'ownerId' in request.query
      ? String((request.query as { ownerId?: string }).ownerId || actor.id)
      : null
    const { ownerId } = resolveOwnedTargetId(actor, requestedOwnerId)
    const limit = data.siteSettings.workLimitPerOwner || 10
    const items = data.works.filter((work) => work.ownerId === ownerId)
    const quotaSummary = buildWorkGalleryQuotaSummary(data, { ownerId, actorId: actor.id, tier: actor.tier })
    return {
      ok: true,
      items,
      limit,
      quotaSummary,
      shareLinks: data.shareLinks.filter((link) => items.some((work) => work.id === link.workId)),
    }
  })

  app.post('/api/works', async (request, reply) => {
    const body = (request.body || {}) as Partial<WorkRecord> & { canvasData?: string; previewImageUrl?: string | null }
    const now = new Date().toISOString()
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const { ownerId } = resolveOwnedTargetId(actor, body.ownerId || null)
      const limit = data.siteSettings.workLimitPerOwner || 10
      const quotaSummary = buildWorkGalleryQuotaSummary(data, { ownerId, actorId: actor.id, tier: actor.tier })
      if (quotaSummary.works.reached) return { work: null, limit, quotaSummary }
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
      return { work, limit, quotaSummary: buildWorkGalleryQuotaSummary(data, { ownerId, actorId: actor.id, tier: actor.tier }) }
    })
    if (!result.work) {
      reply.code(409).send({
        ok: false,
        error: `Work limit reached (${result.limit}). Delete an existing work before saving a new one.`,
        quotaSummary: result.quotaSummary,
      })
      return
    }
    return { ok: true, work: result.work, quotaSummary: result.quotaSummary }
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
      const { ownerId } = resolveOwnedTargetId(actor, body.ownerId || null)
      const limit = data.siteSettings.workLimitPerOwner || 10
      const quotaSummary = buildWorkGalleryQuotaSummary(data, { ownerId, actorId: actor.id, tier: actor.tier })
      if (quotaSummary.works.reached) return { work: null, limit, quotaSummary }
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
      return { work, limit, quotaSummary: buildWorkGalleryQuotaSummary(data, { ownerId, actorId: actor.id, tier: actor.tier }) }
    })
    if (!result.work) {
      reply.code(409).send({ ok: false, error: `Work limit reached (${result.limit}).`, quotaSummary: result.quotaSummary })
      return
    }
    return { ok: true, work: result.work, quotaSummary: result.quotaSummary }
  })

  app.get('/api/works/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const data = await localDataStore.read()
    const work = data.works.find((item) => item.id === id)
    if (!work || !canAccessWork(data, request, work)) {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    const actor = getActor(data, request)
    return {
      ok: true,
      work,
      shareLinks: data.shareLinks.filter((link) => link.workId === id),
      galleryEntry: data.galleryEntries.find((entry) => entry.workId === id) || null,
      quotaSummary: buildWorkGalleryQuotaSummary(data, { ownerId: work.ownerId, actorId: actor.id, tier: actor.tier }),
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
          applyBlockedWorkPublicSafety(data, id, next.safetyReview)
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

  app.delete('/api/works/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const deleted = await localDataStore.update((data) => {
      const work = data.works.find((item) => item.id === id)
      if (!work || !canAccessWork(data, request, work)) return false
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
      return true
    })
    if (!deleted) {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
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
        const publicSafety = applyBlockedWorkPublicSafety(data, id, safetyReview)
        data.auditEvents.push({
          id: createId('audit'),
          actorId: actor.id,
          actorTier: actor.tier,
          action: 'work.shareBlocked',
          ip: getClientIp(request),
          createdAt: now,
          metadata: { workId: id, safetyReview, publicSafety },
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
      if (!eligibility.ok) return {
        status: 'denied' as const,
        eligibility,
        quotaSummary: buildWorkGalleryQuotaSummary(data, { ownerId: work.ownerId, actorId: actor.id, tier: actor.tier }),
      }
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
      return {
        status: 'ok' as const,
        entry,
        work,
        eligibility,
        quotaSummary: buildWorkGalleryQuotaSummary(data, { ownerId: work.ownerId, actorId: actor.id, tier: actor.tier }),
      }
    })
    if (result.status === 'missing') {
      reply.code(404).send({ ok: false, error: 'Work not found' })
      return
    }
    if (result.status === 'denied') {
      reply.code(403).send({
        ok: false,
        error: result.eligibility.reason,
        limit: result.eligibility.limit,
        count: result.eligibility.count,
        quotaSummary: result.quotaSummary,
      })
      return
    }
    return { ok: true, entry: result.entry, work: result.work, limit: result.eligibility.limit, quotaSummary: result.quotaSummary }
  })

  app.get('/api/gallery', async (request) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    const query = (request.query || {}) as { includeReview?: string; includeOwn?: string }
    const includeReview = query.includeReview === 'true' && tierAtLeast(actor.tier, 'admin')
    const includeOwn = query.includeOwn === 'true'
    const entries = data.galleryEntries
      .filter((entry) => includeReview || (includeOwn && entry.ownerId === actor.id) || isPublicGalleryEntry(data, entry))
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
      quotaSummary: buildWorkGalleryQuotaSummary(data, { ownerId: actor.id, actorId: actor.id, tier: actor.tier }),
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
      const publicSafety = applyBlockedWorkPublicSafety(data, entry.workId, safetyReview)
      if (status === 'published' && safetyReview.status === 'blocked') {
        data.auditEvents.push({
          id: createId('audit'),
          actorId: actor.id,
          actorTier: actor.tier,
          action: 'gallery.reviewBlocked',
          ip: getClientIp(request),
          createdAt: now,
          metadata: { galleryEntryId: entry.id, workId: entry.workId, safetyReview, publicSafety },
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
      const publicSafety = applyBlockedWorkPublicSafety(data, entry.workId, safetyReview)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'gallery.safetyReview',
        ip: getClientIp(request),
        createdAt: safetyReview.checkedAt,
        metadata: { galleryEntryId: entry.id, workId: entry.workId, safetyReview, publicSafety },
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
