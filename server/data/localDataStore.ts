import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_DISCLAIMER_POLICY,
  DEFAULT_NOTICES,
  DEFAULT_PERSONAL_SETTINGS,
  DEFAULT_PROVIDER_CHANNELS,
  DEFAULT_RATE_LIMIT_POLICIES,
  DEFAULT_SITE_SETTINGS,
} from './defaults'
import type {
  AuditEvent,
  AuthSession,
  DisclaimerPolicy,
  NoticeMessage,
  PersonalSettings,
  ProviderChannel,
  RateLimitPolicy,
  SiteSettings,
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
    auditEvents: [],
    rateLimitPolicies: DEFAULT_RATE_LIMIT_POLICIES,
    disclaimerPolicy: DEFAULT_DISCLAIMER_POLICY,
  }
}

function mergeDefaults(input: Partial<PublicServerData>): PublicServerData {
  const defaults = createDefaultData()
  return {
    ...defaults,
    ...input,
    siteSettings: { ...defaults.siteSettings, ...(input.siteSettings || {}) },
    personalSettings: { ...defaults.personalSettings, ...(input.personalSettings || {}) },
    disclaimerPolicy: { ...defaults.disclaimerPolicy, ...(input.disclaimerPolicy || {}) },
    providerChannels: input.providerChannels?.length ? input.providerChannels : defaults.providerChannels,
    notices: input.notices?.length ? input.notices : defaults.notices,
    works: input.works || [],
    workflows: input.workflows || [],
    sessions: input.sessions || [],
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
