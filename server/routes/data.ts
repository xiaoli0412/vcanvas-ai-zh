import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import { applyImportData, buildDataExportPayload, DATA_IMPORT_VERIFICATION_TEXT, summarizeImportPayload } from '../lib/dataPortability'
import { getActor, getTierPermissions } from '../lib/platformPolicy'

function canManageData(tier: ReturnType<typeof getActor>['tier']) {
  return getTierPermissions(tier).includes('manage-site') || tier === 'host-admin' || tier === 'admin'
}

export async function registerDataRoutes(app: FastifyInstance) {
  app.get('/api/data/export', async (request: FastifyRequest, reply) => {
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    if (!canManageData(actor.tier)) {
      return reply.code(403).send({ ok: false, error: 'Only host-admin/admin can export inscanvas site data.' })
    }
    if (data.siteSettings.migrationPolicy?.exportEnabled === false) {
      return reply.code(403).send({ ok: false, error: 'inscanvas data export/import is disabled by site migration policy.' })
    }
    const query = request.query as { includeData?: string | boolean } | undefined
    const includeData = query?.includeData === true || query?.includeData === 'true'
    if (includeData) {
      return localDataStore.update((current) => {
        const payload = buildDataExportPayload(current)
        current.auditEvents.push({
          id: createId('audit'),
          actorId: actor.id,
          actorTier: actor.tier,
          action: 'data.export',
          ip: getClientIp(request),
          createdAt: new Date().toISOString(),
          metadata: {
            includes: payload.manifest.includes,
            schemaVersion: payload.manifest.schemaVersion,
          },
        })
        return payload
      })
    }
    const payload = buildDataExportPayload(data)
    return {
      ok: true,
      manifest: payload.manifest,
      verificationText: DATA_IMPORT_VERIFICATION_TEXT,
    }
  })

  app.post('/api/data/import', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as Record<string, unknown>
    const current = await localDataStore.read()
    const actor = getActor(current, request)
    if (!canManageData(actor.tier)) {
      return reply.code(403).send({ ok: false, error: 'Only host-admin/admin can import inscanvas site data.' })
    }
    if (current.siteSettings.migrationPolicy?.exportEnabled === false) {
      return reply.code(403).send({ ok: false, error: 'inscanvas data export/import is disabled by site migration policy.' })
    }
    const dryRun = body.confirmImport !== true
    if (dryRun) {
      try {
        return {
          ok: true,
          dryRun: true,
          verificationRequired: current.siteSettings.migrationPolicy?.requireVerification !== false,
          verificationText: DATA_IMPORT_VERIFICATION_TEXT,
          ...summarizeImportPayload(body),
        }
      } catch (err) {
        return reply.code(400).send({ ok: false, error: err instanceof Error ? err.message : 'Invalid data import payload.' })
      }
    }
    if (current.siteSettings.migrationPolicy?.requireVerification !== false && body.verificationText !== DATA_IMPORT_VERIFICATION_TEXT) {
      return reply.code(400).send({ ok: false, error: `Type "${DATA_IMPORT_VERIFICATION_TEXT}" before applying a local-json import.` })
    }
    try {
      const result = await localDataStore.update((data) => {
        const importResult = applyImportData(data, body)
        data.auditEvents.push({
          id: createId('audit'),
          actorId: actor.id,
          actorTier: actor.tier,
          action: 'data.import',
          ip: getClientIp(request),
          createdAt: new Date().toISOString(),
          metadata: {
            applied: importResult.applied,
            schemaVersion: importResult.manifest.schemaVersion,
          },
        })
        return importResult
      })
      return {
        ok: true,
        dryRun: false,
        ...result,
      }
    } catch (err) {
      return reply.code(400).send({ ok: false, error: err instanceof Error ? err.message : 'Invalid data import payload.' })
    }
  })
}
