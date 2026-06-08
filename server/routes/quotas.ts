import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { RedeemCode, UserTier } from '../../shared/contracts/publicServer'
import { dailySignInRecord, getActor, getTierPermissions, refreshQuotaLedger } from '../lib/platformPolicy'

function canManageRedeemCodes(tier: UserTier) {
  const permissions = getTierPermissions(tier)
  return permissions.includes('manage-site') || permissions.includes('manage-users')
}

function maskRedeemCode(code: string) {
  return code.replace(/.(?=.{4})/g, '*')
}

function normalizeRewardNumber(value: unknown) {
  const number = Math.floor(Number(value) || 0)
  return Math.max(0, Math.min(999999, number))
}

function normalizeTierUpgrade(value: unknown): UserTier | undefined {
  if (value === 'host-admin' || value === 'admin' || value === 'vip') return value
  return undefined
}

function generateRedeemCode() {
  const segment = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `INSC-${segment()}-${segment()}`
}

function safeRedeemCode(code: RedeemCode, reveal = false) {
  return {
    id: code.id,
    code: reveal ? code.code : maskRedeemCode(code.code),
    tierUpgrade: code.tierUpgrade,
    premiumCredits: code.premiumCredits || 0,
    baseCallCredits: code.baseCallCredits || 0,
    hostedRunCredits: code.hostedRunCredits || 0,
    expiresAt: code.expiresAt,
    maxRedemptions: code.maxRedemptions,
    redeemedCount: code.redeemedCount,
    redeemedBy: reveal ? code.redeemedBy || [] : undefined,
    enabled: code.enabled ?? true,
    note: code.note || null,
    createdBy: code.createdBy || null,
    createdAt: code.createdAt || null,
    updatedAt: code.updatedAt || null,
  }
}

function applyRedeemReward(data: { users: any[]; sessions: any[] }, actorId: string, ledger: any, code: RedeemCode) {
  ledger.premiumCredits += code.premiumCredits || 0
  ledger.baseCallsRemaining += code.baseCallCredits || 0
  ledger.hostedRunsRemaining = (ledger.hostedRunsRemaining || 0) + (code.hostedRunCredits || 0)
  if (code.tierUpgrade) {
    ledger.tier = code.tierUpgrade
    const user = data.users.find((item) => item.id === actorId)
    if (user) user.tier = code.tierUpgrade
    data.sessions = data.sessions.map((session) => (
      session.userId === actorId ? { ...session, tier: code.tierUpgrade } : session
    ))
  }
}

export async function registerQuotaRoutes(app: FastifyInstance) {
  app.get('/api/quotas/sign-in', async (request) => {
    return localDataStore.update((data) => {
      const actor = getActor(data, request)
      const ledger = refreshQuotaLedger(data, actor.id, actor.tier)
      const todayRecord = dailySignInRecord(data, actor.id)
      return {
        ok: true,
        ledger,
        records: data.signInRecords.filter((record) => record.userId === actor.id).slice(-7),
        canSignIn: !todayRecord,
        todayRecord,
        nextResetAt: ledger.resetAt,
      }
    })
  })

  app.post('/api/quotas/sign-in', async (request) => {
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const ledger = refreshQuotaLedger(data, actor.id, actor.tier)
      const todayRecord = dailySignInRecord(data, actor.id)
      if (todayRecord) {
        return {
          ledger,
          record: todayRecord,
          alreadySignedIn: true,
          nextResetAt: ledger.resetAt,
        }
      }
      ledger.baseCallsRemaining += actor.tier === 'guest' ? 1 : 3
      if (actor.tier === 'vip' || actor.tier === 'user') {
        ledger.hostedRunsRemaining = Math.min(actor.tier === 'vip' ? 6 : 2, (ledger.hostedRunsRemaining || 0) + 1)
      }
      const record = {
        id: createId('signin'),
        userId: actor.id,
        tier: actor.tier,
        source: 'daily-checkin' as const,
        ip: getClientIp(request),
        userAgent: String(request.headers['user-agent'] || ''),
        createdAt: new Date().toISOString(),
      }
      data.signInRecords.push(record)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'quota.signIn',
        ip: getClientIp(request),
        createdAt: record.createdAt,
      })
      return { ledger, record, alreadySignedIn: false, nextResetAt: ledger.resetAt }
    })
    return { ok: true, ...result }
  })

  app.get('/api/quotas/redeem', async (request) => {
    return localDataStore.update((data) => {
      const actor = getActor(data, request)
      const admin = canManageRedeemCodes(actor.tier)
      return {
        ok: true,
        ledger: refreshQuotaLedger(data, actor.id, actor.tier),
        redeemCodes: admin ? data.redeemCodes.map((code) => safeRedeemCode(code, true)) : [],
      }
    })
  })

  app.post('/api/quotas/redeem', async (request, reply) => {
    const body = (request.body || {}) as { code?: string }
    const codeValue = body.code?.trim()
    if (!codeValue) {
      reply.code(400).send({ ok: false, error: 'Missing redeem code.' })
      return
    }
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const code = data.redeemCodes.find((item) => item.code === codeValue && (item.enabled ?? true))
      if (!code) return { status: 'missing' as const }
      if (Date.parse(code.expiresAt) < Date.now()) return { status: 'expired' as const }
      if (code.redeemedCount >= code.maxRedemptions) return { status: 'exhausted' as const }
      if (code.redeemedBy?.includes(actor.id)) return { status: 'used' as const }
      const ledger = refreshQuotaLedger(data, actor.id, actor.tier)
      applyRedeemReward(data, actor.id, ledger, code)
      code.redeemedCount += 1
      code.redeemedBy = [...(code.redeemedBy || []), actor.id]
      code.updatedAt = new Date().toISOString()
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'quota.redeem',
        ip: getClientIp(request),
        createdAt: new Date().toISOString(),
        metadata: { redeemCodeId: code.id },
      })
      return { status: 'ok' as const, ledger }
    })
    if (result.status !== 'ok') {
      reply.code(400).send({ ok: false, error: `Redeem code ${result.status}.` })
      return
    }
    return { ok: true, ledger: result.ledger }
  })

  app.get('/api/quotas/redeem-codes', async (request, reply) => {
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageRedeemCodes(actor.tier)) return { ok: false as const, statusCode: 403, error: 'Only host-admin/admin can manage redeem codes.' }
      return { ok: true as const, redeemCodes: data.redeemCodes.map((code) => safeRedeemCode(code, true)) }
    })
    if (!result.ok) {
      reply.code(result.statusCode).send({ ok: false, error: result.error })
      return
    }
    return { ok: true, redeemCodes: result.redeemCodes }
  })

  app.post('/api/quotas/redeem-codes', async (request, reply) => {
    const body = (request.body || {}) as Partial<RedeemCode>
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageRedeemCodes(actor.tier)) return { ok: false as const, statusCode: 403, error: 'Only host-admin/admin can create redeem codes.' }
      const now = new Date().toISOString()
      const codeValue = String(body.code || generateRedeemCode()).trim().toUpperCase()
      if (data.redeemCodes.some((item) => item.code.toUpperCase() === codeValue)) {
        return { ok: false as const, statusCode: 409, error: 'Redeem code already exists.' }
      }
      const redeemCode: RedeemCode = {
        id: createId('redeem'),
        code: codeValue,
        tierUpgrade: normalizeTierUpgrade(body.tierUpgrade),
        premiumCredits: normalizeRewardNumber(body.premiumCredits),
        baseCallCredits: normalizeRewardNumber(body.baseCallCredits),
        hostedRunCredits: normalizeRewardNumber(body.hostedRunCredits),
        expiresAt: body.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxRedemptions: Math.max(1, Math.min(10000, normalizeRewardNumber(body.maxRedemptions) || 1)),
        redeemedCount: 0,
        redeemedBy: [],
        enabled: body.enabled !== false,
        note: String(body.note || '').slice(0, 80) || null,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
      }
      data.redeemCodes.unshift(redeemCode)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'quota.redeemCode.create',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { redeemCodeId: redeemCode.id, maxRedemptions: redeemCode.maxRedemptions },
      })
      return { ok: true as const, redeemCode: safeRedeemCode(redeemCode, true) }
    })
    if (!result.ok) {
      reply.code(result.statusCode).send({ ok: false, error: result.error })
      return
    }
    return { ok: true, redeemCode: result.redeemCode }
  })

  app.patch('/api/quotas/redeem-codes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as Partial<RedeemCode>
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageRedeemCodes(actor.tier)) return { ok: false as const, statusCode: 403, error: 'Only host-admin/admin can update redeem codes.' }
      const code = data.redeemCodes.find((item) => item.id === id)
      if (!code) return { ok: false as const, statusCode: 404, error: 'Redeem code not found.' }
      if (typeof body.enabled === 'boolean') code.enabled = body.enabled
      if (body.expiresAt) code.expiresAt = body.expiresAt
      if (body.note !== undefined) code.note = String(body.note || '').slice(0, 80) || null
      code.updatedAt = new Date().toISOString()
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'quota.redeemCode.update',
        ip: getClientIp(request),
        createdAt: code.updatedAt,
        metadata: { redeemCodeId: code.id, enabled: code.enabled },
      })
      return { ok: true as const, redeemCode: safeRedeemCode(code, true) }
    })
    if (!result.ok) {
      reply.code(result.statusCode).send({ ok: false, error: result.error })
      return
    }
    return { ok: true, redeemCode: result.redeemCode }
  })
}
