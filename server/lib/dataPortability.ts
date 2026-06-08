import type { DataExportManifest } from '../../shared/contracts/publicServer'
import type { PublicServerData } from '../data/localDataStore'

export const DATA_EXPORT_SCHEMA_VERSION = 'local-json-v1'
export const DATA_IMPORT_VERIFICATION_TEXT = 'IMPORT INSCANVAS DATA'

const COLLECTION_KEYS: Array<keyof PublicServerData> = [
  'siteSettings',
  'personalSettings',
  'providerChannels',
  'notices',
  'works',
  'workflows',
  'sessions',
  'users',
  'quotaLedgers',
  'redeemCodes',
  'blockedIps',
  'rateLimitEvents',
  'signInRecords',
  'shareLinks',
  'galleryEntries',
  'auditEvents',
  'rateLimitPolicies',
  'disclaimerPolicy',
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function countValue(value: unknown) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return 1
  return value == null ? 0 : 1
}

export function buildDataExportManifest(data: PublicServerData): DataExportManifest {
  const counts: Record<string, number> = {}
  for (const key of COLLECTION_KEYS) counts[key] = countValue(data[key])
  return {
    exportedAt: new Date().toISOString(),
    adapter: 'local-json',
    productName: 'inscanvas',
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    includes: COLLECTION_KEYS.map(String),
    counts,
  }
}

export function buildDataExportPayload(data: PublicServerData) {
  const exportData = {} as Partial<PublicServerData>
  for (const key of COLLECTION_KEYS) {
    exportData[key] = clone(data[key]) as never
  }
  return {
    ok: true,
    manifest: buildDataExportManifest(data),
    data: exportData,
  }
}

export function readImportData(payload: unknown): Partial<PublicServerData> {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid data import payload.')
  const body = payload as { data?: unknown }
  const source = body.data && typeof body.data === 'object' ? body.data : payload
  if (!source || typeof source !== 'object') throw new Error('Invalid data import payload.')
  return source as Partial<PublicServerData>
}

export function summarizeImportPayload(payload: unknown) {
  const source = readImportData(payload)
  const counts: Record<string, number> = {}
  const includes: string[] = []
  for (const key of COLLECTION_KEYS) {
    if (source[key] === undefined) continue
    includes.push(String(key))
    counts[String(key)] = countValue(source[key])
  }
  return {
    manifest: {
      exportedAt: new Date().toISOString(),
      adapter: 'local-json' as const,
      productName: 'inscanvas' as const,
      schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
      includes,
      counts,
    },
  }
}

export function applyImportData(target: PublicServerData, payload: unknown) {
  const source = readImportData(payload)
  const applied: string[] = []
  for (const key of COLLECTION_KEYS) {
    const value = source[key]
    if (value === undefined) continue
    if (Array.isArray(target[key])) {
      if (!Array.isArray(value)) throw new Error(`Import collection ${String(key)} must be an array.`)
      target[key] = clone(value) as never
    } else if (target[key] && typeof target[key] === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Import collection ${String(key)} must be an object.`)
      }
      target[key] = { ...(target[key] as object), ...(clone(value) as object) } as never
    } else {
      target[key] = clone(value) as never
    }
    applied.push(String(key))
  }
  return {
    applied,
    manifest: buildDataExportManifest(target),
  }
}
