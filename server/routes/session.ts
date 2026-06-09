import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import {
  getActor,
  getSessionFromRequest,
  getTierPermissions,
  makeSession,
  refreshQuotaLedger,
  resolveLocalLoginTier,
  resolveLocalRegisterTier,
  SESSION_TTL_MS,
  upsertUser,
} from '../lib/platformPolicy'
import type { UserTier } from '../../shared/contracts/publicServer'

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get('/api/session/me', async (request) => {
    const now = new Date().toISOString()
    const result = await localDataStore.update((data) => {
      const session = getSessionFromRequest(data, request)
      if (session) {
        session.lastActiveAt = now
        session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
      }
      const actor = getActor(data, request)
      const user = data.users.find((item) => item.id === actor.id)
      return {
        actor,
        session,
        user,
        quota: refreshQuotaLedger(data, actor.id, actor.tier),
      }
    })

    return {
      ok: true,
      executionMode: result.session?.executionMode || 'browser-local',
      user: {
        id: result.actor.id,
        tier: result.actor.tier,
        displayName: result.user?.profile.displayName || result.actor.displayName,
        permissions: getTierPermissions(result.actor.tier),
      },
      session: result.session || null,
      quota: result.quota,
      loginNotice: {
        ip: getClientIp(request),
        time: now,
        userAgent: request.headers['user-agent'] || null,
      },
    }
  })

  app.post('/api/session/login', async (request) => {
    const body = (request.body || {}) as {
      userId?: string
      username?: string
      email?: string
      tier?: UserTier
      displayName?: string
    }
    const userId = body.userId?.trim() || body.username?.trim() || 'mock-user'
    const ip = getClientIp(request)
    const userAgent = String(request.headers['user-agent'] || '')

    const result = await localDataStore.update((data) => {
      const tier = resolveLocalLoginTier(data, userId)
      const session = makeSession({
        userId,
        tier,
        executionMode: 'server-managed',
        ip,
        userAgent,
      })
      const user = upsertUser(data, {
        id: userId,
        username: body.username || userId,
        email: body.email || null,
        tier,
        displayName: body.displayName || 'inscanvas user',
        ip,
      })
      data.sessions = [...data.sessions.filter((item) => item.userId !== session.userId), session]
      data.signInRecords.push({
        id: createId('signin'),
        userId,
        tier,
        source: 'login',
        ip,
        userAgent,
        createdAt: new Date().toISOString(),
      })
      data.auditEvents.push({
        id: createId('audit'),
        actorId: session.userId,
        actorTier: session.tier,
        action: 'session.login',
        ip: session.ip,
        createdAt: new Date().toISOString(),
      })
      return {
        user,
        session,
        quota: refreshQuotaLedger(data, userId, tier),
      }
    })

    return {
      ok: true,
      executionMode: result.session.executionMode,
      user: {
        id: result.session.userId,
        tier: result.session.tier,
        displayName: result.user.profile.displayName,
        permissions: getTierPermissions(result.session.tier),
      },
      session: result.session,
      quota: result.quota,
      note: 'Local/mock inscanvas login ignores client-supplied tier; real roles must come from the newapi/subapi bridge.',
    }
  })

  app.post('/api/session/register', async (request, reply) => {
    const body = (request.body || {}) as {
      userId?: string
      username?: string
      email?: string
      tier?: UserTier
      displayName?: string
    }
    const data = await localDataStore.read()
    if (data.siteSettings.registrationEnabled === false) {
      reply.code(403).send({ ok: false, error: 'inscanvas registration is temporarily closed by site settings.' })
      return
    }

    const userId = body.userId?.trim() || body.username?.trim() || `user-${Date.now()}`
    const ip = getClientIp(request)
    const userAgent = String(request.headers['user-agent'] || '')

    const result = await localDataStore.update((current) => {
      const tier = resolveLocalRegisterTier(current, userId)
      const session = makeSession({
        userId,
        tier,
        executionMode: tier === 'guest' ? 'browser-local' : 'server-managed',
        ip,
        userAgent,
      })
      const user = upsertUser(current, {
        id: userId,
        username: body.username || userId,
        email: body.email || null,
        tier,
        displayName: body.displayName || 'inscanvas user',
        ip,
      })
      current.sessions = [...current.sessions.filter((item) => item.userId !== session.userId), session]
      current.signInRecords.push({
        id: createId('signin'),
        userId,
        tier,
        source: 'register',
        ip,
        userAgent,
        createdAt: new Date().toISOString(),
      })
      current.auditEvents.push({
        id: createId('audit'),
        actorId: session.userId,
        actorTier: session.tier,
        action: 'session.register',
        ip: session.ip,
        createdAt: new Date().toISOString(),
      })
      return {
        user,
        session,
        quota: refreshQuotaLedger(current, userId, tier),
      }
    })

    return {
      ok: true,
      executionMode: result.session.executionMode,
      user: {
        id: result.session.userId,
        tier: result.session.tier,
        displayName: result.user.profile.displayName,
        permissions: getTierPermissions(result.session.tier),
      },
      session: result.session,
      quota: result.quota,
      note: 'Local/mock inscanvas registration creates user-tier accounts unless an existing user already has a managed tier.',
    }
  })

  app.post('/api/session/logout', async (request, reply) => {
    const body = (request.body || {}) as { userId?: string; sessionId?: string }
    const result = await localDataStore.update((data) => {
      const currentSession = getSessionFromRequest(data, request)
      const actor = getActor(data, request)
      const canManageSessions = getTierPermissions(actor.tier).includes('manage-users')
      const targetSessionId = body.sessionId?.trim()
      const targetUserId = body.userId?.trim()
      let ok = true
      let removed = 0
      let reason = 'no active session to logout'

      if ((targetSessionId || targetUserId) && !currentSession) {
        reason = 'no active session to logout'
      } else if (targetSessionId) {
        if (canManageSessions || currentSession?.id === targetSessionId) {
          const before = data.sessions.length
          data.sessions = data.sessions.filter((session) => session.id !== targetSessionId)
          removed = before - data.sessions.length
          reason = removed > 0 ? 'session logged out' : 'session not found'
        } else {
          ok = false
          reason = 'Cannot logout another user session without admin permission.'
        }
      } else if (targetUserId) {
        if (canManageSessions || currentSession?.userId === targetUserId) {
          const before = data.sessions.length
          data.sessions = data.sessions.filter((session) => session.userId !== targetUserId)
          removed = before - data.sessions.length
          reason = 'user sessions logged out'
        } else {
          ok = false
          reason = 'Cannot logout another user without admin permission.'
        }
      } else if (currentSession) {
        data.sessions = data.sessions.filter((session) => session.id !== currentSession.id)
        removed = 1
        reason = 'current session logged out'
      }

      data.sessions = data.sessions.filter((session) => {
        return Date.parse(session.expiresAt) > Date.now()
      })
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'session.logout',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: { targetUserId: targetUserId || null, targetSessionId: targetSessionId || null, removed, ok, reason },
      })
      return { ok, removed, reason }
    })
    if (!result.ok) {
      reply.code(403)
      return { ok: false, removed: result.removed, error: result.reason }
    }
    return { ok: true, removed: result.removed, note: result.reason }
  })

  app.post('/api/session/guest', async (request, reply) => {
    const current = await localDataStore.read()
    if (current.siteSettings.guestEnabled === false) {
      reply.code(403).send({
        ok: false,
        error: 'Guest access is temporarily closed by site settings.',
        gatingReason: 'guest-access-disabled',
      })
      return
    }
    const ip = getClientIp(request)
    const userAgent = String(request.headers['user-agent'] || '')
    const session = makeSession({
      userId: 'guest-local',
      tier: 'guest',
      executionMode: 'browser-local',
      ip,
      userAgent,
    })
    const quota = await localDataStore.update((data) => {
      data.sessions = [...data.sessions.filter((item) => item.userId !== 'guest-local'), session]
      data.signInRecords.push({
        id: createId('signin'),
        userId: 'guest-local',
        tier: 'guest',
        source: 'guest',
        ip,
        userAgent,
        createdAt: new Date().toISOString(),
      })
      data.auditEvents.push({
        id: createId('audit'),
        actorId: 'guest-local',
        actorTier: 'guest',
        action: 'session.guest',
        ip: session.ip,
        createdAt: new Date().toISOString(),
      })
      return refreshQuotaLedger(data, 'guest-local', 'guest')
    })
    return {
      ok: true,
      executionMode: 'browser-local',
      user: {
        id: 'guest-local',
        tier: 'guest',
        displayName: 'Guest',
        permissions: getTierPermissions('guest'),
      },
      session,
      quota,
    }
  })
}
