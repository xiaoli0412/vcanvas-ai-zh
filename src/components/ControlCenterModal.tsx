import React, { useEffect, useMemo, useState } from 'react'
import type {
  AuthSession,
  BlockedIp,
  DataExportManifest,
  GalleryEntry,
  NoticeMessage,
  OpsSnapshot,
  PlatformCapabilityMaturity,
  PlatformReadinessSnapshot,
  ProviderChannel,
  QuotaLedger,
  RedeemCode,
  SiteSettings,
  UserPermission,
  UserTier,
  WorkflowRun,
  WorkflowRunSummary,
  UpdateCheckResult,
  WorkRecord,
} from '../../shared/contracts/publicServer'
import type { Translate } from '../lib/i18n'
import { clearPublicSession, mergeSessionHeaders, savePublicSession } from '../lib/sessionClient'
import './ControlCenterModal.css'

type ControlTab = 'readiness' | 'overview' | 'personal' | 'workflows' | 'users' | 'site' | 'data' | 'notices' | 'gallery' | 'ops'

interface SessionUser {
  id: string
  tier: UserTier
  displayName: string
  permissions: UserPermission[]
}

interface GalleryEntryWithWork extends GalleryEntry {
  work?: WorkRecord | null
}

interface ManagedUser {
  id: string
  username: string
  email?: string | null
  tier: UserTier
  enabled: boolean
  profile: {
    displayName: string
    avatarUrl?: string | null
    motto?: string
    qq?: string | null
  }
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
  lastLoginIp?: string | null
  summary?: {
    works: number
    workflows: number
    signIns: number
    providerChannels: number
    maskedKeys: number
  }
  providerKeyVisibility?: string
}

interface Props {
  onClose: () => void
  onOpenPersonalSettings: () => void
  onOpenProviderSettings: () => void
  onOpenWorkCenter: () => void
  t: Translate
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Expected JSON from ${response.url || 'request'}, got ${text.slice(0, 48) || response.statusText}`)
  }
  if (!response.ok || data.ok === false) throw new Error(data.error || response.statusText)
  return data as T
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function timeLeft(expiresAt: string | undefined) {
  if (!expiresAt) return '-'
  const ms = Date.parse(expiresAt) - Date.now()
  if (ms <= 0) return 'expired'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Some IP/HTTP deployments expose navigator.clipboard but still reject writes.
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

function safetyReasonLabel(t: Translate, reason: string) {
  const key = `control.gallery.safetyReason.${reason}`
  const label = t(key)
  return label === key ? reason : label
}

function canManageSite(user: SessionUser | null) {
  return Boolean(user?.permissions.includes('manage-site') || user?.tier === 'host-admin' || user?.tier === 'admin')
}

const defaultSharePolicy: NonNullable<SiteSettings['sharePolicy']> = {
  enabled: true,
  publicBaseUrl: '',
  pauseOnSecurityWarning: true,
}

const defaultNoticePolicy: NonNullable<SiteSettings['noticePolicy']> = {
  forceWarnings: true,
  allowMarkdown: true,
  allowImages: true,
}

const defaultUpdatePolicy: NonNullable<SiteSettings['updatePolicy']> = {
  githubRepo: 'xiaoli0412/vcanvas-ai-zh',
  checkEnabled: true,
  lowTrafficAutoUpdate: false,
}

export function ControlCenterModal({
  onClose,
  onOpenPersonalSettings,
  onOpenProviderSettings,
  onOpenWorkCenter,
  t,
}: Props) {
  const [tab, setTab] = useState<ControlTab>('readiness')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loginNotice, setLoginNotice] = useState<{ ip?: string | null; time?: string; userAgent?: string | null } | null>(null)
  const [quota, setQuota] = useState<QuotaLedger | null>(null)
  const [quotaStatus, setQuotaStatus] = useState<{ canSignIn?: boolean; nextResetAt?: string | null } | null>(null)
  const [siteSettings, setSiteSettings] = useState<(SiteSettings & Record<string, any>) | null>(null)
  const [notices, setNotices] = useState<NoticeMessage[]>([])
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([])
  const [providers, setProviders] = useState<ProviderChannel[]>([])
  const [gallery, setGallery] = useState<GalleryEntryWithWork[]>([])
  const [workflows, setWorkflows] = useState<WorkflowRunSummary[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [workflowDetail, setWorkflowDetail] = useState<{ run: WorkflowRun; summary: WorkflowRunSummary } | null>(null)
  const [ops, setOps] = useState<OpsSnapshot | null>(null)
  const [readiness, setReadiness] = useState<PlatformReadinessSnapshot | null>(null)
  const [dataManifest, setDataManifest] = useState<DataExportManifest | null>(null)
  const [dataImportSummary, setDataImportSummary] = useState<DataExportManifest | null>(null)
  const [dataExportText, setDataExportText] = useState('')
  const [dataImportText, setDataImportText] = useState('')
  const [dataVerificationText, setDataVerificationText] = useState('')
  const [dataConfirmText, setDataConfirmText] = useState('')
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | null>(null)
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([])
  const [loginDraft, setLoginDraft] = useState({ username: 'local-admin' })
  const [profileDraft, setProfileDraft] = useState({ displayName: '', motto: '', qq: '', avatarUrl: '' })
  const [noticeDraft, setNoticeDraft] = useState({ kind: 'announcement' as NoticeMessage['kind'], title: '', body: '', force: false })
  const [redeemDraft, setRedeemDraft] = useState({
    code: '',
    tierUpgrade: '',
    premiumCredits: '100',
    baseCallCredits: '20',
    hostedRunCredits: '2',
    maxRedemptions: '1',
    days: '30',
    note: '',
  })
  const [dispatchNodesText, setDispatchNodesText] = useState('[]')
  const [userSearch, setUserSearch] = useState('')
  const [redeemCode, setRedeemCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const admin = canManageSite(user)
  const warningNotices = notices.filter((notice) => notice.kind === 'warning')
  const realtimeNotices = notices.filter((notice) => notice.kind === 'realtime')
  const favoriteProviders = useMemo(() => providers.filter((provider) => provider.favorite || provider.enabled).slice(0, 8), [providers])
  const activeBlockedIps = useMemo(
    () => blockedIps.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
    [blockedIps],
  )
  const blockedIpSet = useMemo(() => new Set(activeBlockedIps.map((item) => item.ip)), [activeBlockedIps])
  const filteredManagedUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    if (!query) return managedUsers
    return managedUsers.filter((managedUser) => [
      managedUser.id,
      managedUser.username,
      managedUser.email || '',
      managedUser.profile.displayName,
      managedUser.lastLoginIp || '',
      managedUser.tier,
    ].some((value) => value.toLowerCase().includes(query)))
  }, [managedUsers, userSearch])
  const sharePolicy = { ...defaultSharePolicy, ...(siteSettings?.sharePolicy || {}) }
  const noticePolicy = { ...defaultNoticePolicy, ...(siteSettings?.noticePolicy || {}) }
  const updatePolicy = { ...defaultUpdatePolicy, ...(siteSettings?.updatePolicy || {}) }
  const dispatch = ops?.dispatch
  const maturityTotals = useMemo(() => {
    const totals: Record<PlatformCapabilityMaturity, number> = {
      production: 0,
      'local-mock': 0,
      'contract-only': 0,
      missing: 0,
    }
    for (const capability of readiness?.capabilities || []) totals[capability.maturity] += 1
    return totals
  }, [readiness])
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) || workflows[0] || null

  const load = async () => {
    setError(null)
    const [sessionPayload, settingsPayload, noticePayload, providerPayload, quotaPayload, redeemPayload, opsPayload, galleryPayload, workflowPayload, readinessPayload] = await Promise.all([
      fetch('/api/session/me', { headers: mergeSessionHeaders() }).then((response) => readJson<{
        user: SessionUser
        session: AuthSession | null
        quota: QuotaLedger | null
        loginNotice: { ip?: string | null; time?: string; userAgent?: string | null }
      }>(response)),
      fetch('/api/settings/site', { headers: mergeSessionHeaders() }).then((response) => readJson<{ settings: SiteSettings & Record<string, any> }>(response)),
      fetch('/api/notices', { headers: mergeSessionHeaders() }).then((response) => readJson<{ notices: NoticeMessage[] }>(response)),
      fetch('/api/providers', { headers: mergeSessionHeaders() }).then((response) => readJson<{ channels: ProviderChannel[] }>(response)),
      fetch('/api/quotas/sign-in', { headers: mergeSessionHeaders() }).then((response) => readJson<{ ledger: QuotaLedger | null; canSignIn?: boolean; nextResetAt?: string | null }>(response)),
      fetch('/api/quotas/redeem', { headers: mergeSessionHeaders() }).then((response) => readJson<{ ledger: QuotaLedger | null }>(response)),
      fetch('/api/ops/status', { headers: mergeSessionHeaders() }).then((response) => readJson<{ snapshot: OpsSnapshot }>(response)),
      fetch('/api/gallery?includeReview=true', { headers: mergeSessionHeaders() }).then((response) => readJson<{ entries?: GalleryEntryWithWork[]; items?: GalleryEntryWithWork[] }>(response)),
      fetch('/api/workflows?limit=24', { headers: mergeSessionHeaders() }).then((response) => readJson<{ items: WorkflowRunSummary[] }>(response)),
      fetch('/api/platform/readiness').then((response) => readJson<PlatformReadinessSnapshot>(response)),
    ])

    setUser(sessionPayload.user)
    setSession(sessionPayload.session)
    setLoginNotice(sessionPayload.loginNotice)
    setQuota(quotaPayload.ledger || redeemPayload.ledger || sessionPayload.quota || null)
    setQuotaStatus({ canSignIn: quotaPayload.canSignIn, nextResetAt: quotaPayload.nextResetAt || quotaPayload.ledger?.resetAt || null })
    setSiteSettings(settingsPayload.settings)
    setDispatchNodesText(JSON.stringify(settingsPayload.settings.dispatchPolicy?.nodes || [], null, 2))
    setNotices(noticePayload.notices || [])
    setProviders(providerPayload.channels || [])
    setOps(opsPayload.snapshot)
    setGallery(galleryPayload.entries || galleryPayload.items || [])
    setWorkflows(workflowPayload.items || [])
    setSelectedWorkflowId((current) => current || workflowPayload.items?.[0]?.id || '')
    setReadiness(readinessPayload)
    if (canManageSite(sessionPayload.user)) {
      const [usersPayload, securityPayload, redeemCodesPayload] = await Promise.all([
        fetch('/api/users', { headers: mergeSessionHeaders() }).then((response) => readJson<{ users: ManagedUser[] }>(response)),
        fetch('/api/security/blocked-ips', { headers: mergeSessionHeaders() }).then((response) => readJson<{ blockedIps: BlockedIp[] }>(response)),
        fetch('/api/quotas/redeem-codes', { headers: mergeSessionHeaders() }).then((response) => readJson<{ redeemCodes: RedeemCode[] }>(response)),
      ])
      setManagedUsers(usersPayload.users || [])
      setBlockedIps(securityPayload.blockedIps || [])
      setRedeemCodes(redeemCodesPayload.redeemCodes || [])
      fetch('/api/data/export', { headers: mergeSessionHeaders() })
        .then((response) => readJson<{ manifest: DataExportManifest; verificationText?: string }>(response))
        .then((payload) => {
          setDataManifest(payload.manifest)
          setDataVerificationText(payload.verificationText || 'IMPORT INSCANVAS DATA')
        })
        .catch(() => undefined)
      fetch('/api/updates/check', { headers: mergeSessionHeaders() })
        .then((response) => readJson<{ update: UpdateCheckResult }>(response))
        .then((payload) => setUpdateCheck(payload.update))
        .catch(() => undefined)
    } else {
      setManagedUsers([])
      setBlockedIps([])
      setRedeemCodes([])
      setDataManifest(null)
      setUpdateCheck(null)
    }
    setProfileDraft({
      displayName: sessionPayload.user.displayName || '',
      motto: '',
      qq: '',
      avatarUrl: '',
    })
  }

  useEffect(() => {
    load().catch((err) => setError(err.message || String(err)))
  }, [])

  const run = async (action: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await action()
      await load()
      setMessage(result || t('control.notice.saved'))
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const login = (register = false) => run(async () => {
    const endpoint = register ? '/api/session/register' : '/api/session/login'
    const payload = await fetch(endpoint, {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        username: loginDraft.username.trim() || 'local-admin',
        userId: loginDraft.username.trim() || 'local-admin',
        displayName: loginDraft.username.trim() || 'inscanvas user',
      }),
    }).then((response) => readJson<{ session?: AuthSession | null }>(response))
    savePublicSession(payload.session)
    return register ? t('control.notice.registeredSafe') : t('control.notice.loggedInSafe')
  })

  const guestLogin = () => run(async () => {
    const payload = await fetch('/api/session/guest', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    }).then((response) => readJson<{ session?: AuthSession | null }>(response))
    clearPublicSession()
    savePublicSession(payload.session)
    return t('control.notice.guest')
  })

  const saveProfile = () => run(async () => {
    await fetch('/api/settings/personal', {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        displayName: profileDraft.displayName || user?.displayName || 'inscanvas user',
        motto: profileDraft.motto.slice(0, 20),
        avatarUrl: profileDraft.avatarUrl || null,
        qq: profileDraft.qq || null,
      }),
    }).then((response) => readJson(response))
  })

  const signIn = () => run(async () => {
    await fetch('/api/quotas/sign-in', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    }).then((response) => readJson(response))
    return t('control.notice.signIn')
  })

  const redeem = () => run(async () => {
    await fetch('/api/quotas/redeem', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ code: redeemCode }),
    }).then((response) => readJson(response))
    setRedeemCode('')
    return t('control.notice.redeemed')
  })

  const createRedeemCode = () => run(async () => {
    const days = Math.max(1, Number(redeemDraft.days) || 30)
    const payload = {
      code: redeemDraft.code.trim() || undefined,
      tierUpgrade: redeemDraft.tierUpgrade || undefined,
      premiumCredits: Number(redeemDraft.premiumCredits) || 0,
      baseCallCredits: Number(redeemDraft.baseCallCredits) || 0,
      hostedRunCredits: Number(redeemDraft.hostedRunCredits) || 0,
      maxRedemptions: Number(redeemDraft.maxRedemptions) || 1,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      note: redeemDraft.note,
    }
    const response = await fetch('/api/quotas/redeem-codes', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then((item) => readJson<{ redeemCode?: RedeemCode }>(item))
    setRedeemDraft((value) => ({ ...value, code: '', note: '' }))
    return response.redeemCode?.code ? `${t('control.notice.redeemCodeCreated')}: ${response.redeemCode.code}` : t('control.notice.redeemCodeCreated')
  })

  const toggleRedeemCode = (code: RedeemCode) => run(async () => {
    await fetch(`/api/quotas/redeem-codes/${encodeURIComponent(code.id)}`, {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ enabled: !(code.enabled ?? true) }),
    }).then((response) => readJson(response))
    return t('control.notice.redeemCodeUpdated')
  })

  const saveSite = () => run(async () => {
    if (!siteSettings) return
    let dispatchNodes = siteSettings.dispatchPolicy?.nodes || []
    try {
      const parsed = (dispatchNodesText.trim() ? JSON.parse(dispatchNodesText) : []) as Array<Record<string, unknown>>
      if (!Array.isArray(parsed)) throw new Error('dispatch nodes must be an array')
      dispatchNodes = parsed.map((node, index) => ({
        id: String(node.id || `node-${index + 1}`),
        url: String(node.url || ''),
        weight: Math.max(1, Number(node.weight) || 1),
        enabled: node.enabled !== false,
        currentLoad: typeof node.currentLoad === 'number' ? node.currentLoad : undefined,
        lastSeenAt: typeof node.lastSeenAt === 'string' ? node.lastSeenAt : null,
      })).filter((node) => node.url)
    } catch {
      throw new Error(t('control.dispatch.invalidJson'))
    }
    const siteSettingsBody = { ...siteSettings }
    delete siteSettingsBody.disclaimerPolicy
    delete siteSettingsBody.rateLimitPolicies
    await fetch('/api/settings/site', {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ...siteSettingsBody,
        dispatchPolicy: {
          enabled: siteSettings.dispatchPolicy?.enabled === true,
          strategy: 'round-robin-weighted',
          nodes: dispatchNodes,
        },
      }),
    }).then((response) => readJson(response))
  })

  const createNotice = () => run(async () => {
    await fetch('/api/notices', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        kind: noticeDraft.kind,
        title: noticeDraft.title || 'inscanvas notice',
        body: noticeDraft.body,
        format: 'markdown',
        audience: 'all',
        enabled: true,
        force: noticeDraft.kind === 'warning' || noticeDraft.force,
        dismissible: noticeDraft.kind !== 'warning',
      }),
    }).then((response) => readJson(response))
    setNoticeDraft({ kind: 'announcement', title: '', body: '', force: false })
    return t('control.notice.noticeCreated')
  })

  const cleanup = () => run(async () => {
    await fetch('/api/maintenance/cleanup', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    }).then((response) => readJson(response))
    return t('control.notice.cleanup')
  })

  const reviewGallery = (entry: GalleryEntryWithWork, status: GalleryEntry['status']) => run(async () => {
    await fetch(`/api/gallery/${encodeURIComponent(entry.id)}/review`, {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        status,
        rejectionReason: status === 'rejected' ? t('control.gallery.defaultRejectReason') : null,
      }),
    }).then((response) => readJson(response))
    return t('control.notice.galleryReviewed')
  })

  const runGallerySafety = (entry: GalleryEntryWithWork) => run(async () => {
    await fetch(`/api/gallery/${encodeURIComponent(entry.id)}/safety-review`, {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    }).then((response) => readJson(response))
    return t('control.notice.gallerySafetyReviewed')
  })

  const exportSiteData = () => run(async () => {
    const payload = await fetch('/api/data/export?includeData=true', { headers: mergeSessionHeaders() })
      .then((response) => readJson<{ manifest: DataExportManifest } & Record<string, unknown>>(response))
    const text = JSON.stringify(payload, null, 2)
    setDataManifest(payload.manifest)
    setDataExportText(text)
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inscanvas-local-json-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    return t('control.notice.dataExported')
  })

  const parseImportText = () => {
    try {
      const value = JSON.parse(dataImportText)
      if (!value || typeof value !== 'object') throw new Error()
      return value as Record<string, unknown>
    } catch {
      throw new Error(t('control.error.importJson'))
    }
  }

  const previewImport = () => run(async () => {
    const payload = parseImportText()
    const result = await fetch('/api/data/import', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then((response) => readJson<{ manifest: DataExportManifest; verificationText?: string }>(response))
    setDataImportSummary(result.manifest)
    if (result.verificationText) setDataVerificationText(result.verificationText)
    return t('control.notice.importPreviewed')
  })

  const applyImport = () => run(async () => {
    const payload = parseImportText()
    const result = await fetch('/api/data/import', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ...payload,
        confirmImport: true,
        verificationText: dataConfirmText,
      }),
    }).then((response) => readJson<{ manifest: DataExportManifest }>(response))
    setDataImportSummary(result.manifest)
    setDataConfirmText('')
    return t('control.notice.dataImported')
  })

  const checkUpdates = () => run(async () => {
    const payload = await fetch('/api/updates/check', { headers: mergeSessionHeaders() })
      .then((response) => readJson<{ update: UpdateCheckResult }>(response))
    setUpdateCheck(payload.update)
    return payload.update.updateAvailable ? t('control.notice.updateAvailable') : t('control.notice.updateChecked')
  })

  const tabs: Array<{ id: ControlTab; label: string; admin?: boolean }> = [
    { id: 'readiness', label: t('control.tab.readiness') },
    { id: 'overview', label: t('control.tab.overview') },
    { id: 'personal', label: t('control.tab.personal') },
    { id: 'workflows', label: t('control.tab.workflows') },
    { id: 'users', label: t('control.tab.users'), admin: true },
    { id: 'site', label: t('control.tab.site'), admin: true },
    { id: 'data', label: t('control.tab.data'), admin: true },
    { id: 'notices', label: t('control.tab.notices') },
    { id: 'gallery', label: t('control.tab.gallery') },
    { id: 'ops', label: t('control.tab.ops'), admin: true },
  ]

  const updateManagedUser = (managedUser: ManagedUser, patch: Partial<Pick<ManagedUser, 'tier' | 'enabled'>>) => run(async () => {
    await fetch(`/api/users/${encodeURIComponent(managedUser.id)}`, {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        tier: patch.tier ?? managedUser.tier,
        enabled: patch.enabled ?? managedUser.enabled,
      }),
    }).then((response) => readJson(response))
  })

  const blockUserIp = (managedUser: ManagedUser) => run(async () => {
    if (!managedUser.lastLoginIp) return
    await fetch('/api/security/blocked-ips', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ip: managedUser.lastLoginIp,
        reason: `Manual block from user guardrail: ${managedUser.username}`,
      }),
    }).then((response) => readJson(response))
    return t('control.notice.ipBlocked')
  })

  const unblockIp = (ip: string) => run(async () => {
    await fetch(`/api/security/blocked-ips/${encodeURIComponent(ip)}`, { method: 'DELETE', headers: mergeSessionHeaders() })
      .then((response) => readJson(response))
    return t('control.notice.ipUnblocked')
  })

  const loadWorkflowDetail = (id: string) => run(async () => {
    const payload = await fetch(`/api/workflows/${encodeURIComponent(id)}`, { headers: mergeSessionHeaders() })
      .then((response) => readJson<{ run: WorkflowRun; summary: WorkflowRunSummary }>(response))
    setSelectedWorkflowId(id)
    setWorkflowDetail(payload)
    return t('control.notice.workflowLoaded')
  })

  const cancelWorkflow = (workflow: WorkflowRunSummary) => run(async () => {
    const payload = await fetch(`/api/workflows/${encodeURIComponent(workflow.id)}`, {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: 'cancelled' }),
    }).then((response) => readJson<{ run: WorkflowRun; summary: WorkflowRunSummary }>(response))
    setWorkflows((items) => items.map((item) => item.id === workflow.id ? payload.summary : item))
    setWorkflowDetail((current) => current?.run.id === workflow.id ? payload : current)
    return t('control.notice.workflowCancelled')
  })

  const copyWorkflowPrompt = (workflow: WorkflowRunSummary) => run(async () => {
    const detail = workflowDetail?.run.id === workflow.id
      ? workflowDetail
      : await fetch(`/api/workflows/${encodeURIComponent(workflow.id)}`, { headers: mergeSessionHeaders() })
        .then((response) => readJson<{ run: WorkflowRun; summary: WorkflowRunSummary }>(response))
    setWorkflowDetail(detail)
    setSelectedWorkflowId(workflow.id)
    await copyText(detail.run.prompt || detail.run.context?.prompt || workflow.promptPreview)
    return t('control.notice.workflowPromptCopied')
  })

  const copyWorkflowSummary = (workflow: WorkflowRunSummary) => run(async () => {
    const text = [
      `inscanvas workflow ${workflow.id}`,
      `action: ${workflow.action}`,
      `mode: ${workflow.modeId}`,
      `execution: ${workflow.executionMode}`,
      `status: ${workflow.status}`,
      `created: ${workflow.createdAt}`,
      `expires: ${workflow.expiresAt || '-'}`,
      `prompt: ${workflow.promptPreview || '-'}`,
      `context: ${JSON.stringify(workflow.contextSummary)}`,
    ].join('\n')
    await copyText(text)
    return t('control.notice.workflowSummaryCopied')
  })

  return (
    <div className="ccm-overlay" onClick={onClose}>
      <div className="ccm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ccm-header">
          <div>
            <div className="ccm-eyebrow">inscanvas control</div>
            <h2>{t('control.title')}</h2>
            <p>{t('control.subtitle')}</p>
          </div>
          <button className="ccm-close" onClick={onClose} aria-label={t('common.close')}>&times;</button>
        </div>

        <div className="ccm-status">
          <span className="ccm-pill on">{user ? `${user.displayName} · ${user.tier}` : t('control.loading')}</span>
          <span className="ccm-pill">{t('control.sessionLeft')}: {timeLeft(session?.expiresAt)}</span>
          <span className="ccm-pill">{t('control.exec')}: {session?.executionMode || 'browser-local'}</span>
          <button className="btn btn-secondary" onClick={load} disabled={busy}>{t('works.refresh')}</button>
        </div>

        {(message || error || warningNotices[0]) && (
          <div className={`ccm-banner ${error ? 'error' : warningNotices[0] ? 'warning' : 'ok'}`}>
            <strong>{error ? t('msg.error') : warningNotices[0]?.title || t('control.message')}</strong>
            <span>{error || message || warningNotices[0]?.body}</span>
          </div>
        )}

        <div className="ccm-body">
          <aside className="ccm-nav">
            {tabs.map((item) => (
              <button
                key={item.id}
                className={`ccm-nav-item ${tab === item.id ? 'active' : ''} ${item.admin && !admin ? 'locked' : ''}`}
                onClick={() => setTab(item.id)}
                disabled={item.admin && !admin}
              >
                {item.label}
                {item.admin && <span>admin</span>}
              </button>
            ))}
          </aside>

          <main className="ccm-main">
            {tab === 'overview' && (
              <div className="ccm-grid">
                <section className="ccm-card hero">
                  <h3>{t('control.overview.identity')}</h3>
                  <p>{t('control.overview.identityNote')}</p>
                  <div className="ccm-login-row">
                    <input value={loginDraft.username} onChange={(event) => setLoginDraft((value) => ({ ...value, username: event.target.value }))} />
                    <span className="ccm-login-rule">{t('control.overview.tierRule')}</span>
                  </div>
                  <div className="ccm-actions">
                    <button className="btn btn-primary" onClick={() => login(false)} disabled={busy}>{t('control.action.mockLogin')}</button>
                    <button className="btn btn-secondary" onClick={() => login(true)} disabled={busy}>{t('control.action.register')}</button>
                    <button className="btn btn-ghost" onClick={guestLogin} disabled={busy}>{t('control.action.guest')}</button>
                  </div>
                </section>

                <section className="ccm-card">
                  <h3>{t('control.overview.loginNotice')}</h3>
                  <div className="ccm-kv"><span>IP</span><strong>{loginNotice?.ip || '-'}</strong></div>
                  <div className="ccm-kv"><span>{t('control.time')}</span><strong>{formatDate(loginNotice?.time)}</strong></div>
                  <div className="ccm-kv"><span>UA</span><strong title={loginNotice?.userAgent || ''}>{loginNotice?.userAgent || '-'}</strong></div>
                </section>

                <section className="ccm-card">
                  <h3>{t('control.overview.quota')}</h3>
                  <div className="ccm-metric"><strong>{quota?.baseCallsRemaining ?? '-'}</strong><span>{t('control.quota.basic')}</span></div>
                  <div className="ccm-metric"><strong>{quota?.premiumCredits ?? '-'}</strong><span>{t('control.quota.premium')}</span></div>
                  <div className="ccm-metric"><strong>{quota?.hostedRunsRemaining ?? '-'}</strong><span>{t('control.quota.hosted')}</span></div>
                  <div className="ccm-kv"><span>{t('control.quota.resetAt')}</span><strong>{formatDate(quotaStatus?.nextResetAt || quota?.resetAt)}</strong></div>
                </section>

                <section className="ccm-card">
                  <h3>{t('control.overview.quickLinks')}</h3>
                  <div className="ccm-actions vertical">
                    <button className="btn btn-secondary" onClick={onOpenPersonalSettings}>{t('control.action.modelSettings')}</button>
                    <button className="btn btn-secondary" onClick={onOpenProviderSettings}>{t('control.action.connectionSettings')}</button>
                    <button className="btn btn-secondary" onClick={onOpenWorkCenter}>{t('works.title')}</button>
                  </div>
                </section>
              </div>
            )}

            {tab === 'readiness' && (
              <div className="ccm-grid">
                <section className="ccm-card hero readiness">
                  <div className="ccm-readiness-score">
                    <strong>{readiness?.overall.score ?? '-'}</strong>
                    <span>{t('control.readiness.score')}</span>
                  </div>
                  <div>
                    <h3>{t('control.readiness.title')}</h3>
                    <p>{t('control.readiness.note')}</p>
                    <div className="ccm-readiness-pills">
                      <span>{t('control.readiness.production')}: {maturityTotals.production}</span>
                      <span>{t('control.readiness.localMock')}: {maturityTotals['local-mock']}</span>
                      <span>{t('control.readiness.contractOnly')}: {maturityTotals['contract-only']}</span>
                      <span>{t('control.readiness.missing')}: {maturityTotals.missing}</span>
                    </div>
                  </div>
                </section>

                <section className="ccm-card wide">
                  <h3>{t('control.readiness.blockers')}</h3>
                  <div className="ccm-readiness-list compact">
                    {(readiness?.blockers || []).map((item) => <span key={item}>{item}</span>)}
                  </div>
                </section>

                <section className="ccm-card wide">
                  <h3>{t('control.readiness.capabilities')}</h3>
                  <div className="ccm-capability-list">
                    {(readiness?.capabilities || []).map((capability) => (
                      <article key={capability.id} className={`ccm-capability ${capability.maturity}`}>
                        <div>
                          <strong>{capability.title}</strong>
                          <span>{capability.domain} · {capability.maturity}</span>
                        </div>
                        <p>{capability.summary}</p>
                        <small>{capability.nextStep}</small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="ccm-card wide">
                  <h3>{t('control.readiness.recommendations')}</h3>
                  <div className="ccm-readiness-list">
                    {(readiness?.recommendations || []).map((item) => <span key={item}>{item}</span>)}
                  </div>
                </section>
              </div>
            )}

            {tab === 'personal' && (
              <div className="ccm-grid">
                <section className="ccm-card wide">
                  <h3>{t('control.personal.profile')}</h3>
                  <div className="ccm-form-grid">
                    <label>{t('control.field.displayName')}<input value={profileDraft.displayName} onChange={(event) => setProfileDraft((value) => ({ ...value, displayName: event.target.value }))} /></label>
                    <label>{t('control.field.motto')}<input maxLength={20} value={profileDraft.motto} onChange={(event) => setProfileDraft((value) => ({ ...value, motto: event.target.value }))} /></label>
                    <label>QQ<input value={profileDraft.qq} onChange={(event) => setProfileDraft((value) => ({ ...value, qq: event.target.value }))} /></label>
                    <label>{t('control.field.avatar')}<input value={profileDraft.avatarUrl} onChange={(event) => setProfileDraft((value) => ({ ...value, avatarUrl: event.target.value }))} /></label>
                  </div>
                  <button className="btn btn-primary" onClick={saveProfile} disabled={busy}>{t('provider.save')}</button>
                </section>
                <section className="ccm-card">
                  <h3>{t('control.personal.quota')}</h3>
                  <button className="btn btn-primary" onClick={signIn} disabled={busy || quotaStatus?.canSignIn === false}>{quotaStatus?.canSignIn === false ? t('control.quota.signedToday') : t('control.action.signIn')}</button>
                  <div className="ccm-kv"><span>{t('control.quota.resetAt')}</span><strong>{formatDate(quotaStatus?.nextResetAt || quota?.resetAt)}</strong></div>
                  <div className="ccm-redeem">
                    <input value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} placeholder={t('control.placeholder.redeem')} />
                    <button className="btn btn-secondary" onClick={redeem} disabled={busy || !redeemCode.trim()}>{t('control.action.redeem')}</button>
                  </div>
                </section>
              </div>
            )}

            {tab === 'workflows' && (
              <div className="ccm-grid">
                <section className="ccm-card wide">
                  <div className="ccm-section-row">
                    <div>
                      <h3>{t('control.workflows.title')}</h3>
                      <p>{t('control.workflows.note')}</p>
                    </div>
                    <span className="ccm-pill">{workflows.length} / 24h</span>
                  </div>
                  {workflows.length === 0 ? (
                    <div className="ccm-empty">{t('control.workflows.empty')}</div>
                  ) : (
                    <div className="ccm-workflow-list">
                      {workflows.map((workflow) => (
                        <button
                          key={workflow.id}
                          className={`ccm-workflow-item ${selectedWorkflow?.id === workflow.id ? 'active' : ''} ${workflow.status}`}
                          onClick={() => {
                            setSelectedWorkflowId(workflow.id)
                            setWorkflowDetail(null)
                          }}
                        >
                          <span className="ccm-workflow-main">
                            <strong>{workflow.action} · {workflow.modeId}</strong>
                            <small>{workflow.promptPreview || t('control.workflows.noPrompt')}</small>
                          </span>
                          <span className="ccm-workflow-meta">
                            {workflow.executionMode} · {workflow.status} · {formatDate(workflow.createdAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="ccm-card wide">
                  <div className="ccm-section-row">
                    <div>
                      <h3>{t('control.workflows.selected')}</h3>
                      <p>{t('control.workflows.selectedNote')}</p>
                    </div>
                    {selectedWorkflow && (
                      <span className={`ccm-workflow-badge ${selectedWorkflow.status}`}>{selectedWorkflow.status}</span>
                    )}
                  </div>
                  {selectedWorkflow ? (
                    <>
                      <div className="ccm-workflow-detail-grid">
                        <span>{t('control.workflows.action')}<strong>{selectedWorkflow.action}</strong></span>
                        <span>{t('control.workflows.mode')}<strong>{selectedWorkflow.modeId}</strong></span>
                        <span>{t('control.workflows.execution')}<strong>{selectedWorkflow.executionMode}</strong></span>
                        <span>{t('control.workflows.expires')}<strong>{formatDate(selectedWorkflow.expiresAt)}</strong></span>
                      </div>
                      <div className="ccm-workflow-context">
                        <span>{t('control.workflows.carryPolicy')}: {selectedWorkflow.contextSummary.carryPolicy || '-'}</span>
                        <span>{t('control.workflows.previous')}: {selectedWorkflow.contextSummary.hasPreviousTurn ? t('common.yes') : t('common.no')}</span>
                        <span>{t('control.workflows.website')}: {selectedWorkflow.contextSummary.hasWebsiteReference ? t('common.yes') : t('common.no')}</span>
                        <span>{t('control.workflows.video')}: {selectedWorkflow.contextSummary.hasVideoReference ? t('common.yes') : t('common.no')}</span>
                        <span>{t('control.workflows.embeds')}: {selectedWorkflow.contextSummary.webEmbedCount}</span>
                        <span>{t('control.workflows.annotations')}: {selectedWorkflow.contextSummary.annotationCount}</span>
                        <span>{t('control.workflows.compressed')}: {selectedWorkflow.contextSummary.compressed ? t('common.yes') : t('common.no')}</span>
                      </div>
                      <div className="ccm-workflow-prompt">{selectedWorkflow.promptPreview || t('control.workflows.noPrompt')}</div>
                      {workflowDetail?.run.id === selectedWorkflow.id && (
                        <pre className="ccm-workflow-json">{JSON.stringify({
                          id: workflowDetail.run.id,
                          action: workflowDetail.run.action,
                          context: workflowDetail.summary.contextSummary,
                          prompt: workflowDetail.run.prompt,
                        }, null, 2)}</pre>
                      )}
                      <div className="ccm-actions wrap">
                        <button className="btn btn-secondary" onClick={() => loadWorkflowDetail(selectedWorkflow.id)} disabled={busy}>{t('control.workflows.loadDetail')}</button>
                        <button className="btn btn-secondary" onClick={() => copyWorkflowPrompt(selectedWorkflow)} disabled={busy}>{t('control.workflows.copyPrompt')}</button>
                        <button className="btn btn-secondary" onClick={() => copyWorkflowSummary(selectedWorkflow)} disabled={busy}>{t('control.workflows.copySummary')}</button>
                        <button
                          className="btn btn-ghost danger"
                          onClick={() => cancelWorkflow(selectedWorkflow)}
                          disabled={busy || !['queued', 'running'].includes(selectedWorkflow.status)}
                        >
                          {t('control.workflows.cancel')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="ccm-empty">{t('control.workflows.empty')}</div>
                  )}
                </section>
              </div>
            )}

            {tab === 'users' && (
              <section className="ccm-card wide">
                <div className="ccm-section-row">
                  <div>
                    <h3>{t('control.users.title')}</h3>
                    <p>{t('control.users.note')}</p>
                  </div>
                  <div className="ccm-section-actions">
                    <span className="ccm-pill">{filteredManagedUsers.length}/{managedUsers.length} {t('control.users.count')}</span>
                    <span className="ccm-pill">{activeBlockedIps.length} {t('control.users.blockedIps')}</span>
                  </div>
                </div>
                <div className="ccm-user-toolbar">
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder={t('control.users.search')}
                  />
                </div>
                <div className="ccm-user-table">
                  {filteredManagedUsers.length === 0 && <div className="ccm-empty">{t('control.users.empty')}</div>}
                  {filteredManagedUsers.map((managedUser) => {
                    const ipBlocked = Boolean(managedUser.lastLoginIp && blockedIpSet.has(managedUser.lastLoginIp))
                    const currentIp = Boolean(managedUser.lastLoginIp && managedUser.lastLoginIp === loginNotice?.ip)
                    return (
                    <article key={managedUser.id} className={`ccm-user-row ${managedUser.enabled ? '' : 'disabled'}`}>
                      <div className="ccm-user-main">
                        <strong>{managedUser.profile.displayName || managedUser.username}</strong>
                        <span>{managedUser.username} · {managedUser.id}</span>
                        <small>
                          {t('control.users.lastIp')}: {managedUser.lastLoginIp || '-'}
                          {ipBlocked ? ` · ${t('control.users.ipBlocked')}` : ''}
                          {currentIp ? ` · ${t('control.users.currentIp')}` : ''}
                        </small>
                      </div>
                      <div className="ccm-user-metrics">
                        <span>{managedUser.summary?.works ?? 0}<small>{t('control.users.works')}</small></span>
                        <span>{managedUser.summary?.workflows ?? 0}<small>{t('control.users.workflows')}</small></span>
                        <span>{managedUser.summary?.providerChannels ?? 0}<small>{t('control.users.providers')}</small></span>
                        <span>{managedUser.summary?.maskedKeys ?? 0}<small>{t('control.users.maskedKeys')}</small></span>
                      </div>
                      <div className="ccm-user-controls">
                        <select
                          value={managedUser.tier}
                          onChange={(event) => updateManagedUser(managedUser, { tier: event.target.value as UserTier })}
                          disabled={busy}
                        >
                          <option value="host-admin">host-admin</option>
                          <option value="admin">admin</option>
                          <option value="vip">vip</option>
                          <option value="user">user</option>
                          <option value="guest">guest</option>
                        </select>
                        <button
                          className={`btn ${managedUser.enabled ? 'btn-ghost danger' : 'btn-secondary'}`}
                          onClick={() => updateManagedUser(managedUser, { enabled: !managedUser.enabled })}
                          disabled={busy}
                        >
                          {managedUser.enabled ? t('control.users.disable') : t('control.users.enable')}
                        </button>
                        {ipBlocked && managedUser.lastLoginIp ? (
                          <button className="btn btn-secondary" onClick={() => unblockIp(managedUser.lastLoginIp || '')} disabled={busy}>
                            {t('control.users.unblockIp')}
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost danger"
                            onClick={() => blockUserIp(managedUser)}
                            disabled={busy || !managedUser.lastLoginIp || currentIp}
                          >
                            {t('control.users.blockIp')}
                          </button>
                        )}
                      </div>
                    </article>
                  )})}
                </div>
              </section>
            )}

            {tab === 'site' && siteSettings && (
              <div className="ccm-grid">
                <section className="ccm-card wide">
                  <h3>{t('control.site.title')}</h3>
                  <div className="ccm-form-grid">
                    <label>{t('control.field.siteName')}<input value={siteSettings.siteName || ''} onChange={(event) => setSiteSettings({ ...siteSettings, siteName: event.target.value })} /></label>
                    <label>{t('control.field.publicBaseUrl')}<input value={siteSettings.publicBaseUrl || ''} onChange={(event) => setSiteSettings({ ...siteSettings, publicBaseUrl: event.target.value, sharePolicy: { ...sharePolicy, publicBaseUrl: event.target.value } })} /></label>
                    <label>{t('control.field.securityMode')}<select value={siteSettings.securityMode || 'normal'} onChange={(event) => setSiteSettings({ ...siteSettings, securityMode: event.target.value as SiteSettings['securityMode'] })}><option value="normal">normal</option><option value="limited">limited</option><option value="host-admin-only">host-admin-only</option></select></label>
                    <label>{t('control.field.repo')}<input value={updatePolicy.githubRepo || ''} onChange={(event) => setSiteSettings({ ...siteSettings, updatePolicy: { ...updatePolicy, githubRepo: event.target.value } })} /></label>
                  </div>
                  <textarea className="ccm-textarea" value={siteSettings.longDisclaimer || ''} onChange={(event) => setSiteSettings({ ...siteSettings, longDisclaimer: event.target.value })} />
                  <div className="ccm-switches">
                    <label><input type="checkbox" checked={siteSettings.guestEnabled !== false} onChange={(event) => setSiteSettings({ ...siteSettings, guestEnabled: event.target.checked })} /> {t('control.switch.guest')}</label>
                    <label><input type="checkbox" checked={siteSettings.registrationEnabled !== false} onChange={(event) => setSiteSettings({ ...siteSettings, registrationEnabled: event.target.checked })} /> {t('control.switch.registration')}</label>
                    <label><input type="checkbox" checked={siteSettings.publicGalleryEnabled === true} onChange={(event) => setSiteSettings({ ...siteSettings, publicGalleryEnabled: event.target.checked })} /> {t('control.switch.gallery')}</label>
                    <label><input type="checkbox" checked={noticePolicy.forceWarnings !== false} onChange={(event) => setSiteSettings({ ...siteSettings, noticePolicy: { ...noticePolicy, forceWarnings: event.target.checked } })} /> {t('control.switch.forceWarnings')}</label>
                  </div>
                  <button className="btn btn-primary" onClick={saveSite} disabled={busy}>{t('provider.save')}</button>
                </section>
                <section className="ccm-card">
                  <h3>{t('control.site.providers')}</h3>
                  <p>{t('control.site.providersNote')}</p>
                  <div className="ccm-provider-mini">
                    {favoriteProviders.map((provider) => <span key={provider.id}>{provider.label}<small>{provider.models.length}</small></span>)}
                  </div>
                  <button className="btn btn-secondary" onClick={onOpenPersonalSettings}>{t('control.action.modelSettings')}</button>
                </section>
                <section className="ccm-card wide">
                  <div className="ccm-section-row">
                    <div>
                      <h3>{t('control.dispatch.title')}</h3>
                      <p>{t('control.dispatch.note')}</p>
                    </div>
                    <label className="ccm-inline">
                      <input
                        type="checkbox"
                        checked={siteSettings.dispatchPolicy?.enabled === true}
                        onChange={(event) => setSiteSettings({
                          ...siteSettings,
                          dispatchPolicy: {
                            enabled: event.target.checked,
                            strategy: 'round-robin-weighted',
                            nodes: siteSettings.dispatchPolicy?.nodes || [],
                          },
                        })}
                      />
                      {t('control.dispatch.enabled')}
                    </label>
                  </div>
                  <textarea
                    className="ccm-textarea ccm-node-editor"
                    value={dispatchNodesText}
                    onChange={(event) => setDispatchNodesText(event.target.value)}
                    spellCheck={false}
                  />
                  <div className="ccm-dispatch-example">{t('control.dispatch.example')}</div>
                  <button className="btn btn-primary" onClick={saveSite} disabled={busy}>{t('provider.save')}</button>
                </section>
              </div>
            )}

            {tab === 'data' && admin && (
              <div className="ccm-grid">
                <section className="ccm-card wide">
                  <div className="ccm-section-row">
                    <div>
                      <h3>{t('control.update.title')}</h3>
                      <p>{t('control.update.note')}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={checkUpdates} disabled={busy}>
                      {t('control.action.checkUpdates')}
                    </button>
                  </div>
                  <div className="ccm-update-grid">
                    <div className="ccm-kv"><span>{t('control.update.repo')}</span><strong>{updateCheck?.repo || updatePolicy.githubRepo || '-'}</strong></div>
                    <div className="ccm-kv"><span>{t('control.update.current')}</span><strong>{updateCheck?.currentVersion || '-'}</strong></div>
                    <div className="ccm-kv"><span>{t('control.update.latest')}</span><strong>{updateCheck?.latestVersion || '-'}</strong></div>
                    <div className="ccm-kv"><span>{t('control.update.status')}</span><strong>{updateCheck ? t(updateCheck.updateAvailable ? 'control.update.available' : `control.update.status.${updateCheck.comparison}`) : '-'}</strong></div>
                  </div>
                  {updateCheck?.release?.url && (
                    <a className="ccm-link" href={updateCheck.release.url} target="_blank" rel="noreferrer">
                      {t('control.update.openRelease')}
                    </a>
                  )}
                  {updateCheck?.error && <p className="ccm-dispatch-message">{updateCheck.error}</p>}
                </section>

                <section className="ccm-card wide">
                  <div className="ccm-section-row">
                    <div>
                      <h3>{t('control.data.title')}</h3>
                      <p>{t('control.data.note')}</p>
                    </div>
                    <span className="ccm-pill on">{dataManifest?.schemaVersion || 'local-json-v1'}</span>
                  </div>
                  <div className="ccm-data-summary">
                    {(dataManifest ? Object.entries(dataManifest.counts) : []).map(([key, value]) => (
                      <span key={key}><strong>{value}</strong>{key}</span>
                    ))}
                    {!dataManifest && <div className="ccm-empty compact">{t('control.data.noManifest')}</div>}
                  </div>
                </section>

                <section className="ccm-card wide">
                  <div className="ccm-section-row">
                    <div>
                      <h3>{t('control.redeem.manageTitle')}</h3>
                      <p>{t('control.redeem.manageNote')}</p>
                    </div>
                    <span className="ccm-pill">{redeemCodes.length} {t('control.redeem.codes')}</span>
                  </div>
                  <div className="ccm-form-grid">
                    <label>{t('control.redeem.code')}<input value={redeemDraft.code} onChange={(event) => setRedeemDraft((value) => ({ ...value, code: event.target.value }))} placeholder="INSC-XXXX-XXXX" /></label>
                    <label>{t('control.redeem.tier')}<select value={redeemDraft.tierUpgrade} onChange={(event) => setRedeemDraft((value) => ({ ...value, tierUpgrade: event.target.value }))}><option value="">{t('control.redeem.noTier')}</option><option value="vip">vip</option><option value="admin">admin</option><option value="host-admin">host-admin</option></select></label>
                    <label>{t('control.redeem.premium')}<input type="number" min="0" value={redeemDraft.premiumCredits} onChange={(event) => setRedeemDraft((value) => ({ ...value, premiumCredits: event.target.value }))} /></label>
                    <label>{t('control.redeem.base')}<input type="number" min="0" value={redeemDraft.baseCallCredits} onChange={(event) => setRedeemDraft((value) => ({ ...value, baseCallCredits: event.target.value }))} /></label>
                    <label>{t('control.redeem.hosted')}<input type="number" min="0" value={redeemDraft.hostedRunCredits} onChange={(event) => setRedeemDraft((value) => ({ ...value, hostedRunCredits: event.target.value }))} /></label>
                    <label>{t('control.redeem.max')}<input type="number" min="1" value={redeemDraft.maxRedemptions} onChange={(event) => setRedeemDraft((value) => ({ ...value, maxRedemptions: event.target.value }))} /></label>
                    <label>{t('control.redeem.days')}<input type="number" min="1" value={redeemDraft.days} onChange={(event) => setRedeemDraft((value) => ({ ...value, days: event.target.value }))} /></label>
                    <label>{t('control.redeem.note')}<input value={redeemDraft.note} onChange={(event) => setRedeemDraft((value) => ({ ...value, note: event.target.value }))} /></label>
                  </div>
                  <button className="btn btn-primary" onClick={createRedeemCode} disabled={busy}>{t('control.action.createRedeemCode')}</button>
                  <div className="ccm-redeem-list">
                    {redeemCodes.length === 0 && <div className="ccm-empty compact">{t('control.redeem.empty')}</div>}
                    {redeemCodes.map((code) => (
                      <article key={code.id} className={`ccm-redeem-row ${code.enabled === false ? 'off' : ''}`}>
                        <div>
                          <strong>{code.code}</strong>
                          <span>
                            +{code.baseCallCredits || 0} {t('control.quota.basic')} · +{code.hostedRunCredits || 0} {t('control.quota.hosted')} · +{code.premiumCredits || 0} {t('control.quota.premium')}
                            {code.tierUpgrade ? ` · ${code.tierUpgrade}` : ''}
                          </span>
                          <small>{code.redeemedCount}/{code.maxRedemptions} · {formatDate(code.expiresAt)}{code.note ? ` · ${code.note}` : ''}</small>
                        </div>
                        <button className={`btn ${code.enabled === false ? 'btn-secondary' : 'btn-ghost danger'}`} onClick={() => toggleRedeemCode(code)} disabled={busy}>
                          {code.enabled === false ? t('control.redeem.enable') : t('control.redeem.disable')}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="ccm-card">
                  <h3>{t('control.data.exportTitle')}</h3>
                  <p>{t('control.data.exportNote')}</p>
                  <button className="btn btn-primary" onClick={exportSiteData} disabled={busy}>
                    {t('control.action.exportData')}
                  </button>
                  {dataExportText && (
                    <textarea className="ccm-textarea ccm-json-box" readOnly value={dataExportText} />
                  )}
                </section>

                <section className="ccm-card">
                  <h3>{t('control.data.importTitle')}</h3>
                  <p>{t('control.data.importNote')}</p>
                  <textarea
                    className="ccm-textarea ccm-json-box"
                    value={dataImportText}
                    onChange={(event) => setDataImportText(event.target.value)}
                    placeholder={t('control.placeholder.importJson')}
                    spellCheck={false}
                  />
                  <div className="ccm-actions">
                    <button className="btn btn-secondary" onClick={previewImport} disabled={busy || !dataImportText.trim()}>
                      {t('control.action.previewImport')}
                    </button>
                  </div>
                </section>

                <section className="ccm-card wide">
                  <div className="ccm-section-row">
                    <div>
                      <h3>{t('control.data.dryRun')}</h3>
                      <p>{t('control.data.confirmNote')}</p>
                    </div>
                    <span className="ccm-pill">{t('control.data.verification')}: {dataVerificationText || 'IMPORT INSCANVAS DATA'}</span>
                  </div>
                  <div className="ccm-data-summary compact">
                    {(dataImportSummary ? Object.entries(dataImportSummary.counts) : []).map(([key, value]) => (
                      <span key={key}><strong>{value}</strong>{key}</span>
                    ))}
                    {!dataImportSummary && <div className="ccm-empty compact">{t('control.data.noDryRun')}</div>}
                  </div>
                  <label className="ccm-confirm-field">
                    {t('control.data.confirmImport')}
                    <input
                      value={dataConfirmText}
                      onChange={(event) => setDataConfirmText(event.target.value)}
                      placeholder={dataVerificationText || 'IMPORT INSCANVAS DATA'}
                    />
                  </label>
                  <button
                    className="btn btn-ghost danger"
                    onClick={applyImport}
                    disabled={busy || !dataImportText.trim() || dataConfirmText !== (dataVerificationText || 'IMPORT INSCANVAS DATA')}
                  >
                    {t('control.action.applyImport')}
                  </button>
                </section>
              </div>
            )}

            {tab === 'notices' && (
              <div className="ccm-grid">
                <section className="ccm-card wide">
                  <h3>{t('control.notices.create')}</h3>
                  <div className="ccm-form-grid">
                    <label>{t('control.field.kind')}<select value={noticeDraft.kind} onChange={(event) => setNoticeDraft((value) => ({ ...value, kind: event.target.value as NoticeMessage['kind'] }))}><option value="announcement">announcement</option><option value="realtime">realtime</option><option value="warning">warning</option></select></label>
                    <label>{t('control.field.title')}<input value={noticeDraft.title} onChange={(event) => setNoticeDraft((value) => ({ ...value, title: event.target.value }))} /></label>
                  </div>
                  <textarea className="ccm-textarea" value={noticeDraft.body} onChange={(event) => setNoticeDraft((value) => ({ ...value, body: event.target.value }))} placeholder={t('control.placeholder.notice')} />
                  <label className="ccm-inline"><input type="checkbox" checked={noticeDraft.force} onChange={(event) => setNoticeDraft((value) => ({ ...value, force: event.target.checked }))} /> {t('control.switch.force')}</label>
                  <button className="btn btn-primary" onClick={createNotice} disabled={busy || !noticeDraft.body.trim()}>{t('control.action.createNotice')}</button>
                </section>
                <section className="ccm-card wide">
                  <h3>{t('control.notices.active')}</h3>
                  <div className="ccm-notice-list">
                    {notices.map((notice) => (
                      <article key={notice.id} className={`ccm-notice ${notice.kind}`}>
                        <strong>{notice.title}</strong>
                        <span>{notice.kind} · {notice.force ? 'force' : 'soft'} · {notice.format}</span>
                        <p>{notice.body}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {tab === 'gallery' && (
              <section className="ccm-card wide">
                <h3>{t('control.gallery.title')}</h3>
                <p>{t('control.gallery.note')}</p>
                <div className="ccm-gallery-list">
                  {gallery.length === 0 && <div className="ccm-empty">{t('works.galleryEmpty')}</div>}
                  {gallery.map((entry) => (
                    <article key={entry.id} className="ccm-gallery-item">
                      <div className="ccm-gallery-main">
                        <strong>{entry.work?.title || entry.workId}</strong>
                        <span>{t(`control.gallery.status.${entry.status}`)} · {formatDate(entry.submittedAt)}</span>
                        <p>{entry.work?.description || t('control.gallery.pending')}</p>
                        {entry.rejectionReason && <small>{t('control.gallery.rejectionReason')}: {entry.rejectionReason}</small>}
                        <div className={`ccm-gallery-safety ${entry.safetyReview?.status || 'pending'}`}>
                          <span>
                            {t(`control.gallery.safety.${entry.safetyReview?.status || 'pending'}`)}
                            {entry.safetyReview ? ` · ${t('control.gallery.safetyScore')}: ${entry.safetyReview.riskScore}` : ''}
                          </span>
                          {(entry.safetyReview?.reasons || []).slice(0, 3).map((reason) => (
                            <small key={reason}>{safetyReasonLabel(t, reason)}</small>
                          ))}
                        </div>
                      </div>
                      <div className="ccm-gallery-actions">
                        <span className={`ccm-pill ${entry.status === 'published' ? 'on' : ''}`}>{t(`control.gallery.status.${entry.status}`)}</span>
                        {admin && (
                          <>
                            {entry.status !== 'published' && (
                              <button className="btn btn-secondary" onClick={() => reviewGallery(entry, 'published')} disabled={busy || entry.safetyReview?.status === 'blocked'}>
                                {t('control.gallery.publish')}
                              </button>
                            )}
                            {entry.status !== 'rejected' && (
                              <button className="btn btn-ghost danger" onClick={() => reviewGallery(entry, 'rejected')} disabled={busy}>
                                {t('control.gallery.reject')}
                              </button>
                            )}
                            {entry.status !== 'pending-review' && (
                              <button className="btn btn-ghost" onClick={() => reviewGallery(entry, 'pending-review')} disabled={busy}>
                                {t('control.gallery.restore')}
                              </button>
                            )}
                            <button className="btn btn-ghost" onClick={() => runGallerySafety(entry)} disabled={busy}>
                              {t('control.gallery.rerunSafety')}
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === 'ops' && (
              <div className="ccm-grid">
                <section className="ccm-card">
                  <h3>{t('control.ops.status')}</h3>
                  <div className="ccm-ops-grid">
                    {ops && Object.entries(ops.counts).map(([key, value]) => <span key={key}><strong>{value}</strong>{key}</span>)}
                  </div>
                  <button className="btn btn-secondary" onClick={cleanup} disabled={busy}>{t('control.action.cleanup')}</button>
                </section>
                <section className="ccm-card">
                  <h3>{t('control.ops.hosting')}</h3>
                  <div className="ccm-kv"><span>{t('control.exec')}</span><strong>{ops?.hostingPolicy.defaultExecutionMode || '-'}</strong></div>
                  <div className="ccm-kv"><span>{t('control.heavy')}</span><strong>{ops?.hostingPolicy.resourceHeavyModeDefault || '-'}</strong></div>
                  <div className="ccm-kv"><span>{t('control.fallback')}</span><strong>{ops?.hostingPolicy.fallbackReason || '-'}</strong></div>
                </section>
                <section className="ccm-card wide">
                  <h3>{t('control.dispatch.preview')}</h3>
                  <div className="ccm-kv"><span>{t('control.dispatch.selected')}</span><strong>{dispatch?.selectedNode?.id || '-'}</strong></div>
                  <div className="ccm-kv"><span>{t('control.dispatch.fallback')}</span><strong>{dispatch?.fallbackReason || '-'}</strong></div>
                  <div className="ccm-kv"><span>{t('control.dispatch.mode')}</span><strong>{dispatch?.plannedOnly ? 'planned-only' : 'active'}</strong></div>
                  <p className="ccm-dispatch-message">{dispatch?.message || t('control.dispatch.empty')}</p>
                  <div className="ccm-dispatch-list">
                    {(dispatch?.nodes || []).length === 0 && <div className="ccm-empty compact">{t('control.dispatch.noNodes')}</div>}
                    {(dispatch?.nodes || []).map((node) => (
                      <article key={node.id} className={`ccm-dispatch-item ${node.enabled === false ? 'off' : ''}`}>
                        <div>
                          <strong>{node.id}</strong>
                          <span>{node.url}</span>
                        </div>
                        <small>{t('control.dispatch.weight')}: {node.weight} · {t('control.dispatch.load')}: {node.currentLoad ?? 0}</small>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="ccm-card wide">
                  <h3>{t('control.ops.blockedIps')}</h3>
                  <div className="ccm-blocked-list">
                    {activeBlockedIps.length === 0 && <div className="ccm-empty compact">{t('control.ops.noBlockedIps')}</div>}
                    {activeBlockedIps.map((item) => (
                      <article key={item.ip} className="ccm-blocked-item">
                        <div>
                          <strong>{item.ip}</strong>
                          <span>{item.reason} · {formatDate(item.blockedAt)}</span>
                        </div>
                        <button className="btn btn-secondary" onClick={() => unblockIp(item.ip)} disabled={busy}>
                          {t('control.users.unblockIp')}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
