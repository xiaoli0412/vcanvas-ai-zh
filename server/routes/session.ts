import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import {
  getActor,
  getSessionFromRequest,
  getTierPermissions,
  makeSession,
  normalizeTier,
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
        quota: data.quotaLedgers.find((ledger) => ledger.userId === actor.id) || null,
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
    const tier = normalizeTier(body.tier)
    const userId = body.userId?.trim() || body.username?.trim() || 'mock-user'
    const ip = getClientIp(request)
    const userAgent = String(request.headers['user-agent'] || '')
    const session = makeSession({
      userId,
      tier,
      executionMode: 'server-managed',
      ip,
      userAgent,
    })

    const result = await localDataStore.update((data) => {
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
        quota: data.quotaLedgers.find((ledger) => ledger.userId === userId) || null,
      }
    })

    return {
      ok: true,
      executionMode: session.executionMode,
      user: {
        id: session.userId,
        tier: session.tier,
        displayName: result.user.profile.displayName,
        permissions: getTierPermissions(session.tier),
      },
      session,
      quota: result.quota,
      note: 'Local/mock inscanvas login is active until the newapi/subapi bridge is attached.',
    }
  })

  app.post('/api/session/logout', async (request) => {
    const body = (request.body || {}) as { userId?: string; sessionId?: string }
    await localDataStore.update((data) => {
      data.sessions = data.sessions.filter((session) => {
        if (body.sessionId) return session.id !== body.sessionId
        if (body.userId) return session.userId !== body.userId
        return false
      })
      data.auditEvents.push({
        id: createId('audit'),
        actorId: body.userId || null,
        actorTier: 'guest',
        action: 'session.logout',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
      })
    })
    return { ok: true }
  })

  app.post('/api/session/guest', async (request) => {
    const ip = getClientIp(request)
    const userAgent = String(request.headers['user-agent'] || '')
    const session = makeSession({
      userId: 'guest-local',
      tier: 'guest',
      executionMode: 'browser-local',
      ip,
      userAgent,
    })
    await localDataStore.update((data) => {
      data.sessions = [...data.sessions.filter((item) => item.userId !== 'guest-local'), session]
      data.signInRecords.push({
        id: createId('signin'),
        userId: 'guest-local',
        tier: 'guest',
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
    }
  })
}
