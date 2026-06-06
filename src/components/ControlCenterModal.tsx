import React, { useEffect, useMemo, useState } from 'react'
import type {
  AuthSession,
  BlockedIp,
  GalleryEntry,
  NoticeMessage,
  OpsSnapshot,
  ProviderChannel,
  QuotaLedger,
  SiteSettings,
  UserPermission,
  UserTier,
  WorkRecord,
} from '../../shared/contracts/publicServer'
import type { Translate } from '../lib/i18n'
import './ControlCenterModal.css'

type ControlTab = 'overview' | 'personal' | 'users' | 'site' | 'notices' | 'gallery' | 'ops'

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
  const data = await response.json()
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
  const [tab, setTab] = useState<ControlTab>('overview')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loginNotice, setLoginNotice] = useState<{ ip?: string | null; time?: string; userAgent?: string | null } | null>(null)
  const [quota, setQuota] = useState<QuotaLedger | null>(null)
  const [siteSettings, setSiteSettings] = useState<(SiteSettings & Record<string, any>) | null>(null)
  const [notices, setNotices] = useState<NoticeMessage[]>([])
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([])
  const [providers, setProviders] = useState<ProviderChannel[]>([])
  const [gallery, setGallery] = useState<GalleryEntryWithWork[]>([])
  const [ops, setOps] = useState<OpsSnapshot | null>(null)
  const [loginDraft, setLoginDraft] = useState({ username: 'local-admin', tier: 'host-admin' as UserTier })
  const [profileDraft, setProfileDraft] = useState({ displayName: '', motto: '', qq: '', avatarUrl: '' })
  const [noticeDraft, setNoticeDraft] = useState({ kind: 'announcement' as NoticeMessage['kind'], title: '', body: '', force: false })
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

  const load = async () => {
    setError(null)
    const [sessionPayload, settingsPayload, noticePayload, providerPayload, quotaPayload, redeemPayload, opsPayload, galleryPayload] = await Promise.all([
      fetch('/api/session/me').then((response) => readJson<{
        user: SessionUser
        session: AuthSession | null
        quota: QuotaLedger | null
        loginNotice: { ip?: string | null; time?: string; userAgent?: string | null }
      }>(response)),
      fetch('/api/settings/site').then((response) => readJson<{ settings: SiteSettings & Record<string, any> }>(response)),
      fetch('/api/notices').then((response) => readJson<{ notices: NoticeMessage[] }>(response)),
      fetch('/api/providers').then((response) => readJson<{ channels: ProviderChannel[] }>(response)),
      fetch('/api/quotas/sign-in').then((response) => readJson<{ ledger: QuotaLedger | null }>(response)),
      fetch('/api/quotas/redeem').then((response) => readJson<{ ledger: QuotaLedger | null }>(response)),
      fetch('/api/ops/status').then((response) => readJson<{ snapshot: OpsSnapshot }>(response)),
      fetch('/api/gallery').then((response) => readJson<{ entries?: GalleryEntryWithWork[]; items?: GalleryEntryWithWork[] }>(response)),
    ])

    setUser(sessionPayload.user)
    setSession(sessionPayload.session)
    setLoginNotice(sessionPayload.loginNotice)
    setQuota(quotaPayload.ledger || redeemPayload.ledger || sessionPayload.quota || null)
    setSiteSettings(settingsPayload.settings)
    setNotices(noticePayload.notices || [])
    setProviders(providerPayload.channels || [])
    setOps(opsPayload.snapshot)
    setGallery(galleryPayload.entries || galleryPayload.items || [])
    if (canManageSite(sessionPayload.user)) {
      const [usersPayload, securityPayload] = await Promise.all([
        fetch('/api/users').then((response) => readJson<{ users: ManagedUser[] }>(response)),
        fetch('/api/security/blocked-ips').then((response) => readJson<{ blockedIps: BlockedIp[] }>(response)),
      ])
      setManagedUsers(usersPayload.users || [])
      setBlockedIps(securityPayload.blockedIps || [])
    } else {
      setManagedUsers([])
      setBlockedIps([])
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
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginDraft.username.trim() || 'local-admin',
        userId: loginDraft.username.trim() || 'local-admin',
        tier: loginDraft.tier,
        displayName: loginDraft.username.trim() || 'inscanvas user',
      }),
    }).then((response) => readJson(response))
    return register ? t('control.notice.registered') : t('control.notice.loggedIn')
  })

  const guestLogin = () => run(async () => {
    await fetch('/api/session/guest', { method: 'POST' }).then((response) => readJson(response))
    return t('control.notice.guest')
  })

  const saveProfile = () => run(async () => {
    await fetch('/api/settings/personal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: profileDraft.displayName || user?.displayName || 'inscanvas user',
        motto: profileDraft.motto.slice(0, 20),
        avatarUrl: profileDraft.avatarUrl || null,
        qq: profileDraft.qq || null,
      }),
    }).then((response) => readJson(response))
  })

  const signIn = () => run(async () => {
    await fetch('/api/quotas/sign-in', { method: 'POST' }).then((response) => readJson(response))
    return t('control.notice.signIn')
  })

  const redeem = () => run(async () => {
    await fetch('/api/quotas/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: redeemCode }),
    }).then((response) => readJson(response))
    setRedeemCode('')
    return t('control.notice.redeemed')
  })

  const saveSite = () => run(async () => {
    if (!siteSettings) return
    await fetch('/api/settings/site', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteSettings),
    }).then((response) => readJson(response))
  })

  const createNotice = () => run(async () => {
    await fetch('/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    await fetch('/api/maintenance/cleanup', { method: 'POST' }).then((response) => readJson(response))
    return t('control.notice.cleanup')
  })

  const tabs: Array<{ id: ControlTab; label: string; admin?: boolean }> = [
    { id: 'overview', label: t('control.tab.overview') },
    { id: 'personal', label: t('control.tab.personal') },
    { id: 'users', label: t('control.tab.users'), admin: true },
    { id: 'site', label: t('control.tab.site'), admin: true },
    { id: 'notices', label: t('control.tab.notices') },
    { id: 'gallery', label: t('control.tab.gallery') },
    { id: 'ops', label: t('control.tab.ops'), admin: true },
  ]

  const updateManagedUser = (managedUser: ManagedUser, patch: Partial<Pick<ManagedUser, 'tier' | 'enabled'>>) => run(async () => {
    await fetch(`/api/users/${encodeURIComponent(managedUser.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: managedUser.lastLoginIp,
        reason: `Manual block from user guardrail: ${managedUser.username}`,
      }),
    }).then((response) => readJson(response))
    return t('control.notice.ipBlocked')
  })

  const unblockIp = (ip: string) => run(async () => {
    await fetch(`/api/security/blocked-ips/${encodeURIComponent(ip)}`, { method: 'DELETE' })
      .then((response) => readJson(response))
    return t('control.notice.ipUnblocked')
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
                    <select value={loginDraft.tier} onChange={(event) => setLoginDraft((value) => ({ ...value, tier: event.target.value as UserTier }))}>
                      <option value="host-admin">host-admin</option>
                      <option value="admin">admin</option>
                      <option value="vip">vip</option>
                      <option value="user">user</option>
                    </select>
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
                  <button className="btn btn-primary" onClick={signIn} disabled={busy}>{t('control.action.signIn')}</button>
                  <div className="ccm-redeem">
                    <input value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} placeholder={t('control.placeholder.redeem')} />
                    <button className="btn btn-secondary" onClick={redeem} disabled={busy || !redeemCode.trim()}>{t('control.action.redeem')}</button>
                  </div>
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
                      <strong>{entry.work?.title || entry.workId}</strong>
                      <span>{entry.status} · {formatDate(entry.submittedAt)}</span>
                      <p>{entry.work?.description || t('control.gallery.pending')}</p>
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
