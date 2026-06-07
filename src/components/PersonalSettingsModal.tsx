import React, { useEffect, useMemo, useState } from 'react'
import type { ModelCapability, PersonalSettings, ProviderChannel } from '../../shared/contracts/publicServer'
import type { Translate } from '../lib/i18n'
import { mergeSessionHeaders } from '../lib/sessionClient'
import './PersonalSettingsModal.css'

interface Props {
  onClose: () => void
  onOpenConnectionSettings: () => void
  t: Translate
}

const EMPTY_MODEL: ModelCapability = {
  id: '',
  label: '',
  source: 'manual',
  vision: true,
  video: false,
  toolCalling: false,
  contextWindow: 128000,
  favorite: true,
  serverSide: true,
  verifiedAt: null,
  verifiedSourceUrl: null,
}

function CapabilityBadges({ model }: { model: ModelCapability }) {
  return (
    <span className="psm-badges">
      {model.vision && <span className="psm-badge image">IMG</span>}
      {model.video && <span className="psm-badge video">VID</span>}
      {model.toolCalling && <span className="psm-badge tool">TOOL</span>}
      {typeof model.contextWindow === 'number' && <span className="psm-badge ctx">{Math.max(1, Math.round(model.contextWindow / 1000))}K</span>}
    </span>
  )
}

export function PersonalSettingsModal({ onClose, onOpenConnectionSettings, t }: Props) {
  const [channels, setChannels] = useState<ProviderChannel[]>([])
  const [settings, setSettings] = useState<PersonalSettings | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [query, setQuery] = useState('')
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set())
  const [draftModel, setDraftModel] = useState<ModelCapability>(EMPTY_MODEL)
  const [batch, setBatch] = useState({ vision: true, video: false, toolCalling: false, contextWindow: 128000 })
  const [channelDraft, setChannelDraft] = useState({ endpoint: '', apiKey: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    const [providerResponse, settingsResponse] = await Promise.all([
      fetch('/api/providers', { headers: mergeSessionHeaders() }).then((res) => res.json()),
      fetch('/api/settings/personal', { headers: mergeSessionHeaders() }).then((res) => res.json()),
    ])
    setChannels(providerResponse.channels || [])
    setSettings(settingsResponse.settings || settingsResponse)
    setSelectedChannelId((current) => current || providerResponse.channels?.[0]?.id || '')
  }

  useEffect(() => {
    load().catch((err) => setError(err.message || String(err)))
  }, [])

  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) || channels[0]
  useEffect(() => {
    setChannelDraft({ endpoint: selectedChannel?.endpoint && selectedChannel.endpoint !== '[hidden]' ? selectedChannel.endpoint : '', apiKey: '' })
  }, [selectedChannel?.id, selectedChannel?.endpoint])

  const visibleModels = useMemo(() => {
    const models = selectedChannel?.models || []
    const keyword = query.trim().toLowerCase()
    const sorted = [...models].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.label.localeCompare(b.label))
    if (!keyword) return sorted
    return sorted.filter((model) => `${model.id} ${model.label}`.toLowerCase().includes(keyword))
  }, [query, selectedChannel])

  const postProvider = async (payload: unknown) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || t('personalSettings.error.providerUpdate'))
      setChannels(data.channels || (data.channel ? channels.map((item) => item.id === data.channel.id ? data.channel : item) : channels))
      await load()
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const savePersonal = async (nextSettings: PersonalSettings) => {
    setSettings(nextSettings)
    await fetch('/api/settings/personal', {
      method: 'PATCH',
      headers: mergeSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(nextSettings),
    })
  }

  const addManualModel = async () => {
    if (!selectedChannel || !draftModel.id.trim()) return
    await postProvider({
      batchCapabilities: [{
        providerId: selectedChannel.id,
        modelId: draftModel.id.trim(),
        capability: {
          ...draftModel,
          id: draftModel.id.trim(),
          label: draftModel.label.trim() || draftModel.id.trim(),
          source: 'manual',
        },
      }],
    })
    setDraftModel(EMPTY_MODEL)
  }

  const applyBatch = async () => {
    if (!selectedChannel || selectedModelIds.size === 0) return
    await postProvider({
      batchCapabilities: [...selectedModelIds].map((modelId) => ({
        providerId: selectedChannel.id,
        modelId,
        capability: batch,
      })),
    })
    setSelectedModelIds(new Set())
  }

  const saveChannelConnection = async (clearApiKey = false) => {
    if (!selectedChannel) return
    await postProvider({
      id: selectedChannel.id,
      endpoint: channelDraft.endpoint.trim() || selectedChannel.endpoint,
      apiKey: clearApiKey ? undefined : channelDraft.apiKey,
      clearApiKey,
    })
    setChannelDraft((value) => ({ ...value, apiKey: '' }))
  }

  const toggleModelSelection = (modelId: string) => {
    setSelectedModelIds((current) => {
      const next = new Set(current)
      if (next.has(modelId)) next.delete(modelId)
      else next.add(modelId)
      return next
    })
  }

  const toggleFavorite = async (model: ModelCapability) => {
    if (!selectedChannel) return
    await postProvider({
      batchCapabilities: [{
        providerId: selectedChannel.id,
        modelId: model.id,
        capability: { favorite: !model.favorite },
      }],
    })
  }

  const hostingEnabled = settings?.experimental?.serverHighResourceHosting === true

  return (
    <div className="psm-overlay" onClick={onClose}>
      <div className="psm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="psm-header">
          <div>
            <div className="psm-eyebrow">{t('personalSettings.eyebrow')}</div>
            <h2>{t('personalSettings.title')}</h2>
          </div>
          <button className="psm-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="psm-body">
          <aside className="psm-sidebar">
            <button className="psm-nav active">{t('personalSettings.nav.models')}</button>
            <button className="psm-nav">{t('personalSettings.nav.experimental')}</button>
            <button className="psm-nav muted">{t('personalSettings.nav.works')}</button>
            <button className="psm-nav muted">{t('personalSettings.nav.about')}</button>
          </aside>

          <main className="psm-main">
            <section className="psm-section">
              <div className="psm-section-head">
                <div>
                  <h3>{t('personalSettings.providerGovernance.title')}</h3>
                  <p>{t('personalSettings.providerGovernance.note')}</p>
                </div>
                <button className="btn btn-secondary" onClick={onOpenConnectionSettings} type="button">
                  {t('personalSettings.openConnection')}
                </button>
              </div>

              <div className="psm-channel-strip">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className={`psm-channel ${channel.id === selectedChannel?.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedChannelId(channel.id)
                      setSelectedModelIds(new Set())
                    }}
                  >
                    <span>{channel.label}</span>
                    <small>{t('personalSettings.modelsCount', { count: channel.models.length })}</small>
                  </button>
                ))}
              </div>

              {selectedChannel && (
                <div className="psm-custody">
                  <div className="psm-custody-status">
                    <strong>{t('personalSettings.custodyTitle')}</strong>
                    <span className={`psm-custody-pill ${selectedChannel.keyCustody?.status || 'none'}`}>
                      {selectedChannel.keyCustody?.status || 'none'}
                    </span>
                    <small>{selectedChannel.keyCustody?.note || t('personalSettings.custodyEmpty')}</small>
                  </div>
                  <div className="psm-custody-form">
                    <input
                      value={channelDraft.endpoint}
                      onChange={(event) => setChannelDraft((value) => ({ ...value, endpoint: event.target.value }))}
                      placeholder={t('personalSettings.endpointPlaceholder')}
                      spellCheck={false}
                    />
                    <input
                      value={channelDraft.apiKey}
                      onChange={(event) => setChannelDraft((value) => ({ ...value, apiKey: event.target.value }))}
                      placeholder={selectedChannel.apiKeyMasked || t('personalSettings.apiKeyPlaceholder')}
                      type="password"
                      spellCheck={false}
                    />
                    <button className="btn btn-primary" onClick={() => saveChannelConnection(false)} disabled={saving} type="button">
                      {t('personalSettings.saveCustody')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => saveChannelConnection(true)} disabled={saving} type="button">
                      {t('personalSettings.clearKey')}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="psm-section">
              <div className="psm-section-head compact">
                <div>
                  <h3>{t('personalSettings.modelCapabilityTitle', { channel: selectedChannel?.label || t('personalSettings.channelFallback') })}</h3>
                  <p>{selectedChannel?.verifiedSourceUrl || t('personalSettings.verificationPending')}</p>
                </div>
                <input
                  className="psm-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('personalSettings.search')}
                  spellCheck={false}
                />
              </div>

              <div className="psm-model-list">
                {visibleModels.length === 0 && (
                  <div className="psm-empty">
                    {t('personalSettings.noModels')}
                  </div>
                )}
                {visibleModels.map((model) => (
                  <div key={model.id} className={`psm-model ${selectedModelIds.has(model.id) ? 'selected' : ''}`}>
                    <label className="psm-model-check">
                      <input
                        type="checkbox"
                        checked={selectedModelIds.has(model.id)}
                        onChange={() => toggleModelSelection(model.id)}
                      />
                      <span>
                        <strong>{model.label}</strong>
                        <small>{model.id}</small>
                      </span>
                    </label>
                    <CapabilityBadges model={model} />
                    <button className="psm-fav" onClick={() => toggleFavorite(model)} type="button">
                      {model.favorite ? t('personalSettings.pin') : t('personalSettings.pinThis')}
                    </button>
                  </div>
                ))}
              </div>

              <div className="psm-batch">
                <strong>{t('personalSettings.batchTitle')}</strong>
                <label><input type="checkbox" checked={batch.vision} onChange={(event) => setBatch((value) => ({ ...value, vision: event.target.checked }))} /> {t('personalSettings.capability.vision')}</label>
                <label><input type="checkbox" checked={batch.video} onChange={(event) => setBatch((value) => ({ ...value, video: event.target.checked }))} /> {t('personalSettings.capability.video')}</label>
                <label><input type="checkbox" checked={batch.toolCalling} onChange={(event) => setBatch((value) => ({ ...value, toolCalling: event.target.checked }))} /> {t('personalSettings.capability.toolCalling')}</label>
                <input
                  type="number"
                  min={4096}
                  step={1024}
                  value={batch.contextWindow}
                  onChange={(event) => setBatch((value) => ({ ...value, contextWindow: Number(event.target.value) || 0 }))}
                  aria-label={t('personalSettings.contextWindow')}
                />
                <button className="btn btn-primary" onClick={applyBatch} disabled={saving || selectedModelIds.size === 0} type="button">
                  {t('personalSettings.batchApply', { count: selectedModelIds.size })}
                </button>
              </div>

              <div className="psm-manual">
                <strong>{t('personalSettings.manualTitle')}</strong>
                <input value={draftModel.id} onChange={(event) => setDraftModel((value) => ({ ...value, id: event.target.value }))} placeholder="model-id" />
                <input value={draftModel.label} onChange={(event) => setDraftModel((value) => ({ ...value, label: event.target.value }))} placeholder={t('personalSettings.manualLabel')} />
                <button className="btn btn-secondary" onClick={addManualModel} disabled={saving || !draftModel.id.trim()} type="button">
                  {t('personalSettings.manualAddPinned')}
                </button>
              </div>
            </section>

            <section className="psm-section psm-hosting">
              <div>
                <h3>{t('personalSettings.hostingTitle')}</h3>
                <p>{t('personalSettings.hostingNote')}</p>
              </div>
              <button
                type="button"
                className={`psm-toggle ${hostingEnabled ? 'on' : ''}`}
                onClick={() => settings && savePersonal({
                  ...settings,
                  experimental: { serverHighResourceHosting: !hostingEnabled },
                })}
              >
                {hostingEnabled ? t('personalSettings.hostingOn') : t('personalSettings.hostingOff')}
              </button>
            </section>

            {error && <div className="psm-error">{error}</div>}
          </main>
        </div>
      </div>
    </div>
  )
}
