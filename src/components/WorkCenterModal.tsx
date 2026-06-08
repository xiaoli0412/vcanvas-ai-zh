import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasModeId, GalleryEntry, ShareLink, UserTier, WorkRecord } from '../../shared/contracts/publicServer'
import type { Translate } from '../lib/i18n'
import { mergeSessionHeaders } from '../lib/sessionClient'
import './WorkCenterModal.css'

interface SessionUser {
  id: string
  tier: UserTier
  displayName: string
}

interface GalleryEntryWithWork extends GalleryEntry {
  work?: WorkRecord | null
}

interface Props {
  lastHTML: string
  modeId: CanvasModeId
  promptDraft: string
  getCanvasData: () => string | null
  onClose: () => void
  t: Translate
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function makeDefaultTitle(promptDraft: string, fallback: string) {
  const normalized = promptDraft.trim().replace(/\s+/g, ' ')
  if (!normalized) return fallback
  return normalized.length > 34 ? `${normalized.slice(0, 34)}...` : normalized
}

function downloadHtml(work: WorkRecord) {
  if (!work.html) return
  const blob = new Blob([work.html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${work.title || 'inscanvas-work'}-${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok || data.ok === false) throw new Error(data.error || response.statusText)
  return data as T
}

export function WorkCenterModal({ lastHTML, modeId, promptDraft, getCanvasData, onClose, t }: Props) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [works, setWorks] = useState<WorkRecord[]>([])
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [galleryEntries, setGalleryEntries] = useState<GalleryEntryWithWork[]>([])
  const [limit, setLimit] = useState(10)
  const [selectedId, setSelectedId] = useState('')
  const [title, setTitle] = useState(() => makeDefaultTitle(promptDraft, t('canvas.untitled')))
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [overLimitMode, setOverLimitMode] = useState<'save' | 'import' | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)

  const selectedWork = works.find((work) => work.id === selectedId) || works[0] || null
  const selectedShare = selectedWork ? shareLinks.find((link) => link.workId === selectedWork.id) : null
  const selectedGalleryEntry = selectedWork ? galleryEntries.find((entry) => entry.workId === selectedWork.id) : null
  const canSaveCurrentOutput = Boolean(lastHTML.trim())
  const workCountLabel = `${works.length}/${limit}`

  const load = async () => {
    setError(null)
    const session = await fetch('/api/session/me', { headers: mergeSessionHeaders() }).then((response) => readJson<{
      user: SessionUser
    }>(response))
    const [workPayload, galleryPayload] = await Promise.all([
      fetch(`/api/works?ownerId=${encodeURIComponent(session.user.id)}`, { headers: mergeSessionHeaders() }).then((response) => readJson<{
        items: WorkRecord[]
        limit: number
        shareLinks: ShareLink[]
      }>(response)),
      fetch('/api/gallery?includeOwn=true', { headers: mergeSessionHeaders() }).then((response) => readJson<{
        entries?: GalleryEntryWithWork[]
        items?: GalleryEntryWithWork[]
      }>(response)),
    ])
    setUser(session.user)
    setWorks(workPayload.items || [])
    setLimit(workPayload.limit || 10)
    setShareLinks(workPayload.shareLinks || [])
    setGalleryEntries(galleryPayload.entries || galleryPayload.items || [])
    if ((workPayload.items || []).length < (workPayload.limit || 10)) setOverLimitMode(null)
    setSelectedId((current) => current || workPayload.items?.[0]?.id || '')
  }

  useEffect(() => {
    load().catch((err) => setError(err.message || String(err)))
  }, [])

  useEffect(() => {
    if (!selectedWork) return
    setTitle(selectedWork.title)
    setDescription(selectedWork.description || '')
  }, [selectedWork?.id])

  const runAction = async (action: () => Promise<string | void>, successMessage: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const message = await action()
      await load()
      setNotice(message || successMessage)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const saveCurrent = () => runAction(async () => {
    if (!lastHTML.trim()) throw new Error(t('works.error.noHtml'))
    if (works.length >= limit) {
      setOverLimitMode('save')
      return t('works.notice.overLimit')
    }
    const response = await fetch('/api/works', {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ownerId: user?.id,
        title: title.trim() || makeDefaultTitle(promptDraft, t('canvas.untitled')),
        description: description.trim(),
        modeId,
        status: 'saved',
        html: lastHTML,
        canvasData: getCanvasData(),
      }),
    })
    const data = await readJson<{ work: WorkRecord }>(response)
    setSelectedId(data.work.id)
  }, t('works.notice.saved'))

  const updateSelected = () => runAction(async () => {
    if (!selectedWork) return
    const response = await fetch(`/api/works/${encodeURIComponent(selectedWork.id)}`, {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        title: title.trim() || selectedWork.title,
        description: description.trim(),
      }),
    })
    await readJson(response)
  }, t('works.notice.updated'))

  const shareSelected = () => runAction(async () => {
    if (!selectedWork) return
    const response = await fetch(`/api/works/${encodeURIComponent(selectedWork.id)}/share`, {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    })
    const data = await readJson<{ link: ShareLink }>(response)
    const sharePath = `/share/${data.link.slug}`
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`)
      return t('works.notice.sharedCopied')
    } catch {
      return t('works.notice.shared')
    }
  }, t('works.notice.shared'))

  const submitGallery = () => runAction(async () => {
    if (!selectedWork) return
    const response = await fetch(`/api/works/${encodeURIComponent(selectedWork.id)}/gallery-submit`, {
      method: 'POST',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    })
    await readJson(response)
  }, t('works.notice.gallerySubmitted'))

  const deleteSelected = () => runAction(async () => {
    if (!selectedWork) return
    const response = await fetch(`/api/works/${encodeURIComponent(selectedWork.id)}`, { method: 'DELETE', headers: mergeSessionHeaders() })
    await readJson(response)
    setSelectedId('')
  }, t('works.notice.deleted'))

  const deleteForSpace = (workId: string) => runAction(async () => {
    const response = await fetch(`/api/works/${encodeURIComponent(workId)}`, { method: 'DELETE', headers: mergeSessionHeaders() })
    await readJson(response)
    if (selectedId === workId) setSelectedId('')
    return t('works.notice.deletedForSpace')
  }, t('works.notice.deletedForSpace'))

  const importHtml = () => {
    importRef.current?.click()
  }

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await runAction(async () => {
      const html = await file.text()
      if (works.length >= limit) {
        setOverLimitMode('import')
        return t('works.notice.overLimit')
      }
      const response = await fetch('/api/works/import-html', {
        method: 'POST',
        headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ownerId: user?.id,
          title: file.name.replace(/\.(html?|HTML?)$/, '') || t('works.importedTitle'),
          description: t('works.importedDescription'),
          modeId,
          html,
          canvasData: getCanvasData(),
        }),
      })
      const data = await readJson<{ work: WorkRecord }>(response)
      setSelectedId(data.work.id)
    }, t('works.notice.imported'))
  }

  const selectedMeta = useMemo(() => {
    if (!selectedWork) return null
    return [
      `${t('works.meta.mode')}: ${selectedWork.modeId}`,
      `${t('works.meta.updated')}: ${formatDate(selectedWork.updatedAt)}`,
      `${t('works.meta.snapshots')}: ${selectedWork.snapshots?.length || 0}`,
    ].join(' · ')
  }, [selectedWork, t])

  return (
    <div className="wcm-overlay" onClick={onClose}>
      <div className="wcm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="wcm-header">
          <div>
            <div className="wcm-eyebrow">{t('works.eyebrow')}</div>
            <h2>{t('works.title')}</h2>
            <p>{t('works.subtitle')}</p>
          </div>
          <button className="wcm-close" onClick={onClose} aria-label={t('common.close')}>&times;</button>
        </div>

        <div className="wcm-toolbar">
          <span className="wcm-user">
            <span className="wcm-dot" />
            {user ? `${user.displayName} · ${user.tier}` : t('works.loadingUser')}
          </span>
          <span className="wcm-count">{t('works.count', { count: workCountLabel })}</span>
          <button className="btn btn-secondary" onClick={load} disabled={busy}>{t('works.refresh')}</button>
        </div>

        {(error || notice) && (
          <div className={`wcm-message ${error ? 'error' : 'ok'}`}>
            {error || notice}
          </div>
        )}

        {overLimitMode && (
          <div className="wcm-limit-panel">
            <div>
              <strong>{t('works.limit.title')}</strong>
              <p>{t(overLimitMode === 'save' ? 'works.limit.saveDesc' : 'works.limit.importDesc')}</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setOverLimitMode(null)}>{t('common.close')}</button>
            <div className="wcm-limit-list">
              {works.map((work) => (
                <button key={work.id} className="wcm-limit-item" onClick={() => deleteForSpace(work.id)} disabled={busy}>
                  <span>{work.title}</span>
                  <small>{formatDate(work.updatedAt)} · {work.galleryStatus || 'private'}</small>
                  <strong>{t('works.limit.deleteThis')}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="wcm-body">
          <aside className="wcm-list">
            <div className="wcm-section-head">
              <span>{t('works.myWorks')}</span>
              <button className="btn btn-ghost" onClick={importHtml} disabled={busy}>{t('works.importHtml')}</button>
            </div>
            <input
              ref={importRef}
              type="file"
              accept=".html,.htm,text/html"
              hidden
              onChange={handleImportChange}
            />
            {works.length === 0 ? (
              <div className="wcm-empty">{t('works.empty')}</div>
            ) : (
              <div className="wcm-items">
                {works.map((work) => (
                  <button
                    key={work.id}
                    className={`wcm-item ${selectedWork?.id === work.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(work.id)}
                  >
                    <span className="wcm-item-title">{work.title}</span>
                    <span className="wcm-item-meta">{work.galleryStatus || 'private'} · {formatDate(work.updatedAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="wcm-detail">
            <div className="wcm-card">
              <div className="wcm-card-title">{t('works.saveCurrent')}</div>
              <p className="wcm-card-note">{t('works.saveCurrentNote')}</p>
              <label>
                <span>{t('works.field.title')}</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={50} />
              </label>
              <label>
                <span>{t('works.field.description')}</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={50} />
              </label>
              <div className="wcm-actions">
                <button className="btn btn-primary" onClick={saveCurrent} disabled={busy || !canSaveCurrentOutput}>{t('works.saveCurrentAction')}</button>
                <button className="btn btn-secondary" onClick={updateSelected} disabled={busy || !selectedWork}>{t('works.updateMeta')}</button>
              </div>
              {!canSaveCurrentOutput && <span className="wcm-hint">{t('works.noHtmlHint')}</span>}
            </div>

            <div className="wcm-card">
              <div className="wcm-card-title">{t('works.selectedTitle')}</div>
              {selectedWork ? (
                <>
                  <p className="wcm-card-note">{selectedMeta}</p>
                  <div className="wcm-status-grid">
                    <span>{t('works.status.saved')}: {selectedWork.status}</span>
                    <span>{t('works.status.share')}: {selectedShare?.slug || selectedWork.shareSlug || '-'}</span>
                    <span>{t('works.status.gallery')}: {selectedGalleryEntry?.status || selectedWork.galleryStatus || 'private'}</span>
                  </div>
                  <div className="wcm-actions wrap">
                    <button className="btn btn-secondary" onClick={() => downloadHtml(selectedWork)} disabled={!selectedWork.html}>{t('works.exportHtml')}</button>
                    <button className="btn btn-secondary" onClick={shareSelected} disabled={busy}>{t('works.share')}</button>
                    <button className="btn btn-secondary" onClick={submitGallery} disabled={busy}>{t('works.submitGallery')}</button>
                    <button className="btn btn-ghost danger" onClick={deleteSelected} disabled={busy}>{t('works.delete')}</button>
                  </div>
                </>
              ) : (
                <div className="wcm-empty compact">{t('works.selectEmpty')}</div>
              )}
            </div>

            <div className="wcm-card gallery">
              <div className="wcm-card-title">{t('works.galleryTitle')}</div>
              <p className="wcm-card-note">{t('works.galleryNote')}</p>
              {galleryEntries.length === 0 ? (
                <div className="wcm-empty compact">{t('works.galleryEmpty')}</div>
              ) : (
                <div className="wcm-gallery-list">
                  {galleryEntries.slice(0, 6).map((entry) => (
                    <div className="wcm-gallery-item" key={entry.id}>
                      <strong>{entry.work?.title || entry.workId}</strong>
                      <span>{entry.status} · {formatDate(entry.submittedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
