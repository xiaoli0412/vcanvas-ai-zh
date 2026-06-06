import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_DISCLAIMER_POLICY,
  DEFAULT_NOTICES,
  DEFAULT_PERSONAL_SETTINGS,
  DEFAULT_PROVIDER_CHANNELS,
  DEFAULT_QUOTA_LEDGERS,
  DEFAULT_RATE_LIMIT_POLICIES,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_USERS,
} from './defaults'
import type {
  AuditEvent,
  AuthSession,
  BlockedIp,
  DisclaimerPolicy,
  GalleryEntry,
  NoticeMessage,
  PersonalSettings,
  ProviderChannel,
  QuotaLedger,
  RateLimitPolicy,
  RateLimitEvent,
  RedeemCode,
  ShareLink,
  SignInRecord,
  SiteSettings,
  UserAccount,
  WorkRecord,
  WorkflowRun,
} from '../../shared/contracts/publicServer'

export interface PublicServerData {
  siteSettings: SiteSettings
  personalSettings: PersonalSettings
  providerChannels: ProviderChannel[]
  notices: NoticeMessage[]
  works: WorkRecord[]
  workflows: WorkflowRun[]
  sessions: AuthSession[]
  users: UserAccount[]
  quotaLedgers: QuotaLedger[]
  redeemCodes: RedeemCode[]
  blockedIps: BlockedIp[]
  rateLimitEvents: RateLimitEvent[]
  signInRecords: SignInRecord[]
  shareLinks: ShareLink[]
  galleryEntries: GalleryEntry[]
  auditEvents: AuditEvent[]
  rateLimitPolicies: RateLimitPolicy[]
  disclaimerPolicy: DisclaimerPolicy
}

function createDefaultData(): PublicServerData {
  return {
    siteSettings: DEFAULT_SITE_SETTINGS,
    personalSettings: DEFAULT_PERSONAL_SETTINGS,
    providerChannels: DEFAULT_PROVIDER_CHANNELS,
    notices: DEFAULT_NOTICES,
    works: [],
    workflows: [],
    sessions: [],
    users: DEFAULT_USERS,
    quotaLedgers: DEFAULT_QUOTA_LEDGERS,
    redeemCodes: [],
    blockedIps: [],
    rateLimitEvents: [],
    signInRecords: [],
    shareLinks: [],
    galleryEntries: [],
    auditEvents: [],
    rateLimitPolicies: DEFAULT_RATE_LIMIT_POLICIES,
    disclaimerPolicy: DEFAULT_DISCLAIMER_POLICY,
  }
}

function mergeById<T extends { id: string }>(defaults: T[], input?: T[]) {
  const merged = new Map<string, T>()
  for (const item of defaults) merged.set(item.id, item)
  for (const item of input || []) {
    merged.set(item.id, { ...(merged.get(item.id) || ({} as T)), ...item })
  }
  return [...merged.values()]
}

function mergeByKey<T>(defaults: T[], input: T[] | undefined, getKey: (item: T) => string) {
  const merged = new Map<string, T>()
  for (const item of defaults) merged.set(getKey(item), item)
  for (const item of input || []) {
    const key = getKey(item)
    merged.set(key, { ...(merged.get(key) || ({} as T)), ...item })
  }
  return [...merged.values()]
}

function mergeDefaults(input: Partial<PublicServerData>): PublicServerData {
  const defaults = createDefaultData()
  const users = mergeById(defaults.users, input.users)
  const quotaLedgers = mergeByKey(defaults.quotaLedgers, input.quotaLedgers, (item) => item.userId)
  return {
    ...defaults,
    ...input,
    siteSettings: { ...defaults.siteSettings, ...(input.siteSettings || {}) },
    personalSettings: { ...defaults.personalSettings, ...(input.personalSettings || {}) },
    disclaimerPolicy: { ...defaults.disclaimerPolicy, ...(input.disclaimerPolicy || {}) },
    providerChannels: mergeById(defaults.providerChannels, input.providerChannels),
    notices: input.notices?.length ? input.notices : defaults.notices,
    works: input.works || [],
    workflows: input.workflows || [],
    sessions: input.sessions || [],
    users,
    quotaLedgers,
    redeemCodes: input.redeemCodes || [],
    blockedIps: input.blockedIps || [],
    rateLimitEvents: input.rateLimitEvents || [],
    signInRecords: input.signInRecords || [],
    shareLinks: input.shareLinks || [],
    galleryEntries: input.galleryEntries || [],
    auditEvents: input.auditEvents || [],
    rateLimitPolicies: input.rateLimitPolicies?.length ? input.rateLimitPolicies : defaults.rateLimitPolicies,
  }
}

export class LocalDataStore {
  private filePath: string
  private queue: Promise<unknown> = Promise.resolve()

  constructor(filePath?: string) {
    const dataDir = process.env.VCANVAS_DATA_DIR || path.resolve(process.cwd(), '.vcanvas-data')
    this.filePath = filePath || path.join(dataDir, 'public-server.json')
  }

  async read(): Promise<PublicServerData> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      return mergeDefaults(JSON.parse(raw) as Partial<PublicServerData>)
    } catch {
      const data = createDefaultData()
      await this.write(data)
      return data
    }
  }

  async write(data: PublicServerData): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }

  async update<T>(mutator: (data: PublicServerData) => T | Promise<T>): Promise<T> {
    const run = async () => {
      const data = await this.read()
      const result = await mutator(data)
      await this.write(data)
      return result
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => undefined)
    return next
  }
}

export const localDataStore = new LocalDataStore()

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getClientIp(request: { ip?: string; headers: Record<string, unknown> }) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return request.ip || null
}
