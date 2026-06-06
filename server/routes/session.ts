import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { AuthSession, UserTier } from '../../shared/contracts/publicServer'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000

function makeSession(input: {
  userId: string
  tier: UserTier
  displayName: string
  executionMode: AuthSession['executionMode']
  ip?: string | null
  userAgent?: string | null
}): AuthSession & { displayName: string } {
  const now = new Date()
  return {
    id: createId('session'),
    userId: input.userId,
    tier: input.tier,
    executionMode: input.executionMode,
    lastActiveAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    ip: input.ip || null,
    userAgent: input.userAgent || null,
    displayName: input.displayName,
  }
}

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get('/api/session/me', async (request) => {
    const data = await localDataStore.read()
    const now = Date.now()
    const activeSession = data.sessions
      .filter((session) => Date.parse(session.expiresAt) > now)
      .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))[0]

    return {
      ok: true,
      executionMode: activeSession?.executionMode || 'browser-local',
      user: {
        id: activeSession?.userId || 'guest-local',
        tier: activeSession?.tier || 'guest',
        displayName: activeSession?.userId === 'guest-local' ? 'Guest' : 'inscanvas user',
      },
      session: activeSession || null,
      loginNotice: {
        ip: getClientIp(request),
        time: new Date().toISOString(),
        userAgent: request.headers['user-agent'] || null,
      },
    }
  })

  app.post('/api/session/login', async (request) => {
    const body = (request.body || {}) as { userId?: string; tier?: UserTier; displayName?: string }
    const session = makeSession({
      userId: body.userId || 'mock-user',
      tier: body.tier || 'user',
      displayName: body.displayName || 'inscanvas user',
      executionMode: 'server-managed',
      ip: getClientIp(request),
      userAgent: String(request.headers['user-agent'] || ''),
    })
    await localDataStore.update((data) => {
      data.sessions = [...data.sessions.filter((item) => item.userId !== session.userId), session]
      data.auditEvents.push({
        id: createId('audit'),
        actorId: session.userId,
        actorTier: session.tier,
        action: 'session.login',
        ip: session.ip,
        createdAt: new Date().toISOString(),
      })
    })
    return {
      ok: true,
      executionMode: session.executionMode,
      user: {
        id: session.userId,
        tier: session.tier,
        displayName: session.displayName,
      },
      session,
      note: 'Local/mock login is active until the newapi/subapi bridge is attached.',
    }
  })

  app.post('/api/session/logout', async (request) => {
    const body = (request.body || {}) as { userId?: string }
    await localDataStore.update((data) => {
      data.sessions = body.userId
        ? data.sessions.filter((session) => session.userId !== body.userId)
        : []
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
    const session = makeSession({
      userId: 'guest-local',
      tier: 'guest',
      displayName: 'Guest',
      executionMode: 'browser-local',
      ip: getClientIp(request),
      userAgent: String(request.headers['user-agent'] || ''),
    })
    await localDataStore.update((data) => {
      data.sessions = [...data.sessions.filter((item) => item.userId !== 'guest-local'), session]
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
      },
      session,
    }
  })
}
