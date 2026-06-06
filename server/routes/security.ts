import type { FastifyInstance } from 'fastify'
import type { UserTier } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { getActor, getTierPermissions } from '../lib/platformPolicy'

function canManageSecurity(tier: UserTier) {
  return getTierPermissions(tier).includes('manage-users') || getTierPermissions(tier).includes('manage-site')
}

function normalizeIp(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 128) : ''
}

export async function registerSecurityRoutes(app: FastifyInstance) {
  app.get('/api/security/blocked-ips', async (request, reply) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    if (!canManageSecurity(actor.tier)) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can manage inscanvas security controls.' })
      return
    }
    return {
      ok: true,
      blockedIps: data.blockedIps,
      actor: { id: actor.id, tier: actor.tier },
    }
  })

  app.post('/api/security/blocked-ips', async (request, reply) => {
    const body = (request.body || {}) as { ip?: string; reason?: string; expiresInHours?: number | null }
    const ip = normalizeIp(body.ip)
    if (!ip) {
      reply.code(400).send({ ok: false, error: 'IP is required.' })
      return
    }
    const requestIp = getClientIp(request)
    if (requestIp && ip === requestIp) {
      reply.code(400).send({ ok: false, error: 'Refusing to block the current request IP in local/mock mode.' })
      return
    }

    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageSecurity(actor.tier)) return { status: 403 as const, blockedIp: null, actor }
      const now = Date.now()
      const expiresAt = typeof body.expiresInHours === 'number' && body.expiresInHours > 0
        ? new Date(now + body.expiresInHours * 60 * 60 * 1000).toISOString()
        : null
      const blockedIp = {
        ip,
        reason: (body.reason || 'manual admin block').trim().slice(0, 240),
        blockedAt: new Date(now).toISOString(),
        expiresAt,
        createdBy: actor.id,
      }
      data.blockedIps = [...data.blockedIps.filter((item) => item.ip !== ip), blockedIp]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'security.ip.block',
        ip: requestIp,
        createdAt: new Date().toISOString(),
        metadata: { ip, reason: blockedIp.reason, expiresAt },
      })
      return { status: 200 as const, blockedIp, actor }
    })

    if (result.status === 403) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can manage inscanvas security controls.' })
      return
    }
    return { ok: true, blockedIp: result.blockedIp }
  })

  app.delete('/api/security/blocked-ips/:ip', async (request, reply) => {
    const ip = normalizeIp((request.params as { ip: string }).ip)
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageSecurity(actor.tier)) return { status: 403 as const, removed: 0, actor }
      const before = data.blockedIps.length
      data.blockedIps = data.blockedIps.filter((item) => item.ip !== ip)
      const removed = before - data.blockedIps.length
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'security.ip.unblock',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: { ip, removed },
      })
      return { status: 200 as const, removed, actor }
    })

    if (result.status === 403) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can manage inscanvas security controls.' })
      return
    }
    return { ok: true, removed: result.removed }
  })
}
