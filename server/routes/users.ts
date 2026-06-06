import type { FastifyInstance } from 'fastify'
import type { UserTier } from '../../shared/contracts/publicServer'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { getActor, getTierPermissions, normalizeTier } from '../lib/platformPolicy'

function canManageUsers(tier: UserTier) {
  return getTierPermissions(tier).includes('manage-users')
}

function makeUserSummary(data: Awaited<ReturnType<typeof localDataStore.read>>, userId: string) {
  const ownedProviders = data.providerChannels.filter((provider) => provider.ownerId === userId)
  return {
    works: data.works.filter((work) => work.ownerId === userId).length,
    workflows: data.workflows.filter((workflow) => workflow.ownerId === userId).length,
    signIns: data.signInRecords.filter((record) => record.userId === userId).length,
    providerChannels: ownedProviders.length,
    maskedKeys: ownedProviders.filter((provider) => provider.apiKeyMasked).length,
  }
}

export async function registerUserRoutes(app: FastifyInstance) {
  app.get('/api/users', async (request, reply) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    if (!canManageUsers(actor.tier)) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can manage inscanvas users.' })
      return
    }

    const users = data.users.map((user) => ({
      ...user,
      summary: makeUserSummary(data, user.id),
      providerKeyVisibility: user.id === actor.id || actor.tier === 'host-admin'
        ? 'masked-own-or-host-admin'
        : 'masked-admin-view',
    }))

    return {
      ok: true,
      users,
      actor: { id: actor.id, tier: actor.tier },
      note: 'Provider keys are never returned in clear text from this local/mock user-management surface.',
    }
  })

  app.patch('/api/users/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    const body = (request.body || {}) as {
      tier?: UserTier
      enabled?: boolean
      displayName?: string
      motto?: string
      qq?: string | null
      avatarUrl?: string | null
    }
    const now = new Date().toISOString()

    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      if (!canManageUsers(actor.tier)) return { status: 403 as const, user: null, actor }
      const index = data.users.findIndex((user) => user.id === id)
      if (index < 0) return { status: 404 as const, user: null, actor }

      const current = data.users[index]
      const tier = body.tier ? normalizeTier(body.tier) : current.tier
      const next = {
        ...current,
        tier,
        enabled: body.enabled ?? current.enabled,
        profile: {
          ...current.profile,
          displayName: body.displayName ?? current.profile.displayName,
          motto: body.motto ?? current.profile.motto,
          qq: body.qq ?? current.profile.qq,
          avatarUrl: body.avatarUrl ?? current.profile.avatarUrl,
        },
        updatedAt: now,
      }

      data.users[index] = next
      const ledger = data.quotaLedgers.find((item) => item.userId === id)
      if (ledger) ledger.tier = tier
      data.sessions = data.sessions.map((session) => session.userId === id ? { ...session, tier } : session)
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'users.update',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { userId: id, tier, enabled: next.enabled },
      })

      return { status: 200 as const, user: next, actor }
    })

    if (result.status === 403) {
      reply.code(403).send({ ok: false, error: 'Only host-admin/admin can manage inscanvas users.' })
      return
    }
    if (result.status === 404 || !result.user) {
      reply.code(404).send({ ok: false, error: 'User not found.' })
      return
    }

    return { ok: true, user: result.user }
  })
}
