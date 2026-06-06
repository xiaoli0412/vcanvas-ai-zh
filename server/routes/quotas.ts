import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { ensureQuotaLedger, getActor } from '../lib/platformPolicy'

export async function registerQuotaRoutes(app: FastifyInstance) {
  app.get('/api/quotas/sign-in', async (request) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    return {
      ok: true,
      ledger: data.quotaLedgers.find((ledger) => ledger.userId === actor.id) || null,
      records: data.signInRecords.filter((record) => record.userId === actor.id).slice(-7),
    }
  })

  app.post('/api/quotas/sign-in', async (request) => {
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const ledger = ensureQuotaLedger(data, actor.id, actor.tier)
      ledger.baseCallsRemaining += actor.tier === 'guest' ? 1 : 3
      if (actor.tier === 'vip' || actor.tier === 'user') {
        ledger.hostedRunsRemaining = Math.min(2, (ledger.hostedRunsRemaining || 0) + 1)
      }
      const record = {
        id: createId('signin'),
        userId: actor.id,
        tier: actor.tier,
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
      return { ledger, record }
    })
    return { ok: true, ...result }
  })

  app.get('/api/quotas/redeem', async (request) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    return {
      ok: true,
      ledger: data.quotaLedgers.find((ledger) => ledger.userId === actor.id) || null,
      redeemCodes: data.redeemCodes.map((code) => ({
        id: code.id,
        code: code.code.replace(/.(?=.{4})/g, '*'),
        tierUpgrade: code.tierUpgrade,
        premiumCredits: code.premiumCredits,
        expiresAt: code.expiresAt,
        maxRedemptions: code.maxRedemptions,
        redeemedCount: code.redeemedCount,
        enabled: code.enabled ?? true,
      })),
    }
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
      const ledger = ensureQuotaLedger(data, actor.id, actor.tier)
      ledger.premiumCredits += code.premiumCredits || 0
      if (code.tierUpgrade) {
        ledger.tier = code.tierUpgrade
        const user = data.users.find((item) => item.id === actor.id)
        if (user) user.tier = code.tierUpgrade
      }
      code.redeemedCount += 1
      code.redeemedBy = [...(code.redeemedBy || []), actor.id]
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
}
