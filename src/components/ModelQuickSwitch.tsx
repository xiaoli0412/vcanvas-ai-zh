import React, { useMemo, useState } from 'react'
import {
  PROVIDERS,
  getActiveModelId,
  getProvider,
  type ProviderState,
} from '../lib/providers'
import type { Translate } from '../lib/i18n'
import './ModelQuickSwitch.css'

interface Props {
  state: ProviderState
  hasKey: boolean
  onUpdate: (state: ProviderState) => void
  onOpenPersonalSettings: () => void
  onOpenConnectionSettings: () => void
  onClose: () => void
  t: Translate
}

function hasSavedConnection(state: ProviderState, providerId: string) {
  if (providerId === state.activeProviderId) return true
  if ((state.keys[providerId] || '').trim().length > 4) return true
  if (providerId === 'custom') {
    return Boolean(state.custom.endpoint?.trim() || state.custom.baseUrl?.trim() || state.custom.resourceUrl?.trim())
  }
  return false
}

export function ModelQuickSwitch({
  state,
  hasKey,
  onUpdate,
  onOpenPersonalSettings,
  onOpenConnectionSettings,
  onClose,
  t,
}: Props) {
  const [query, setQuery] = useState('')
  const activeProvider = getProvider(state.activeProviderId)
  const activeModelId = getActiveModelId(state)
  const savedProviders = useMemo(() => {
    const items = PROVIDERS.filter((provider) => hasSavedConnection(state, provider.id))
    return items.length ? items : [activeProvider]
  }, [activeProvider, state])
  const visibleProviders = savedProviders.filter((provider) => {
    const value = `${provider.name} ${provider.id}`.toLowerCase()
    return value.includes(query.trim().toLowerCase())
  })

  const selectProvider = (providerId: string) => {
    const provider = getProvider(providerId)
    const nextModelId = providerId === 'custom'
      ? (state.custom.modelId || '')
      : (provider.models[0]?.id || (providerId === state.activeProviderId ? state.activeModelId : ''))
    onUpdate({
      ...state,
      activeProviderId: providerId,
      activeModelId: nextModelId,
    })
  }

  return (
    <div className="mqs-overlay" onClick={onClose}>
      <div className="mqs-card" onClick={(event) => event.stopPropagation()}>
        <div className="mqs-header">
          <div>
            <div className="mqs-eyebrow">{t('modelQuick.eyebrow')}</div>
            <h2>{t('modelQuick.title')}</h2>
          </div>
          <button className="mqs-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="mqs-active">
          <span className={`mqs-dot ${hasKey ? 'on' : ''}`} />
          <div>
            <strong>{activeProvider.name}</strong>
            <span>{activeModelId || t('modelQuick.noModel')}</span>
          </div>
        </div>

        <input
          className="mqs-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('modelQuick.search')}
          spellCheck={false}
        />

        <div className="mqs-provider-list">
          {visibleProviders.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`mqs-provider ${provider.id === state.activeProviderId ? 'active' : ''}`}
              onClick={() => selectProvider(provider.id)}
            >
              <span>{provider.name}</span>
              <small>
                {provider.id === 'custom'
                  ? (state.custom.modelId || t('modelQuick.compatibleEndpoint'))
                  : (provider.models[0]?.label || state.activeModelId || t('modelQuick.manualModel'))}
              </small>
            </button>
          ))}
        </div>

        <div className="mqs-actions">
          <button className="btn btn-secondary" onClick={onOpenConnectionSettings} type="button">
            {t('modelQuick.connection')}
          </button>
          <button className="btn btn-primary" onClick={onOpenPersonalSettings} type="button">
            {t('modelQuick.personalSettings')}
          </button>
        </div>
      </div>
    </div>
  )
}
