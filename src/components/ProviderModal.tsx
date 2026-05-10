import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Translate } from '../lib/i18n'
import {
  PROVIDERS,
  fetchCustomModels,
  fetchOpenRouterModels,
  getActiveModelId,
  getProvider,
  getProviderModelKey,
  getCustomConfigError,
  getCustomConfigErrorForPurpose,
  isModelVisionEnabled,
  type CustomMode,
  type ProviderDef,
  type ProviderState,
  type ModelDef,
  type VisionSupportMap,
} from '../lib/providers'
import './ProviderModal.css'

interface Props {
  state: ProviderState
  visionState: ProviderState
  visionSupportMap: VisionSupportMap
  onUpdate: (state: ProviderState) => void
  onUpdateVisionState: (state: ProviderState) => void
  onUpdateVisionSupportMap: (map: VisionSupportMap) => void
  onClose: () => void
  t: Translate
}

const CUSTOM_MODES: CustomMode[] = ['openai', 'azure', 'compatible']

export function ProviderModal({
  state,
  visionState,
  visionSupportMap,
  onUpdate,
  onUpdateVisionState,
  onUpdateVisionSupportMap,
  onClose,
  t,
}: Props) {
  const [keys, setKeys] = useState<Record<string, string>>({ ...state.keys })
  const [activeProviderId, setActiveProviderId] = useState(state.activeProviderId)
  const [activeModelId, setActiveModelId] = useState(getActiveModelId(state))
  const [custom, setCustom] = useState({ ...state.custom })
  const [visionSupportEnabled, setVisionSupportEnabled] = useState(() => isModelVisionEnabled(getProvider(state.activeProviderId), getActiveModelId(state), visionSupportMap, state.custom))
  const [visionProviderState, setVisionProviderState] = useState<ProviderState>({ ...visionState, keys: { ...visionState.keys }, custom: { ...visionState.custom } })
  const [manualModelId, setManualModelId] = useState(state.custom.modelId || '')
  const [showManualInput, setShowManualInput] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [customFetchedModels, setCustomFetchedModels] = useState<ModelDef[] | null>(null)
  const [customFetchLoading, setCustomFetchLoading] = useState(false)
  const [customFetchError, setCustomFetchError] = useState<string | null>(null)
  const [customModelSearch, setCustomModelSearch] = useState('')
  const [customVisibleCount, setCustomVisibleCount] = useState(12)

  // OpenRouter fetched models
  const [fetchedModels, setFetchedModels] = useState<ModelDef[] | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [modelSearch, setModelSearch] = useState('')
  const fetchedRef = useRef(false)

  const activeProvider = PROVIDERS.find(p => p.id === activeProviderId) || PROVIDERS[0]
  const activeVisionProvider = getProvider(visionProviderState.activeProviderId)
  const activeVisionModelId = getActiveModelId(visionProviderState)
  const activeVisionModelSupportsImages = isModelVisionEnabled(
    activeVisionProvider,
    activeVisionModelId,
    visionSupportMap,
    activeVisionProvider.id === 'custom' ? visionProviderState.custom : undefined,
  )

  const formatCustomError = useCallback((message: string) => {
    const translated = t(message)
    return translated === message ? message : translated
  }, [t])

  // Auto-fetch OpenRouter models when that card is active
  useEffect(() => {
    if (activeProviderId === 'openrouter' && !fetchedRef.current) {
      fetchedRef.current = true
      setFetchLoading(true)
      fetchOpenRouterModels()
        .then(models => {
          setFetchedModels(models)
          setFetchLoading(false)
        })
        .catch(err => {
          setFetchError(err.message)
          setFetchLoading(false)
        })
    }
  }, [activeProviderId])

  const handleKeyChange = useCallback((providerId: string, key: string) => {
    setKeys(prev => ({ ...prev, [providerId]: key }))
  }, [])

  const handleSelectProvider = useCallback((provider: ProviderDef) => {
    setActiveProviderId(provider.id)
    if (provider.id !== activeProviderId) {
      const nextModelId = provider.id === 'custom' ? (custom.modelId || '') : (provider.models[0]?.id || '')
      setActiveModelId(nextModelId)
      setVisionSupportEnabled(isModelVisionEnabled(provider, nextModelId, visionSupportMap, provider.id === 'custom' ? custom : undefined))
      setShowManualInput(false)
      setManualModelId('')
      setModelSearch('')
      setValidationError(null)
    }
  }, [activeProviderId, custom.modelId, visionSupportMap])

  const handleSelectModel = useCallback((modelId: string) => {
    setActiveModelId(modelId)
    setVisionSupportEnabled(isModelVisionEnabled(activeProvider, modelId, visionSupportMap, activeProvider.id === 'custom' ? custom : undefined))
    setShowManualInput(false)
  }, [activeProvider, visionSupportMap])

  const handleManualModelSubmit = useCallback(() => {
    const id = manualModelId.trim()
    if (id) {
      if (activeProviderId === 'custom') {
        setCustom(prev => ({ ...prev, modelId: id }))
      }
      setActiveModelId(id)
      setVisionSupportEnabled(isModelVisionEnabled(activeProvider, id, visionSupportMap, activeProvider.id === 'custom' ? custom : undefined))
      setShowManualInput(false)
      setValidationError(null)
    }
  }, [activeProvider, activeProviderId, manualModelId, visionSupportMap])

  const handleCustomChange = useCallback((field: keyof ProviderState['custom'], value: string) => {
    setCustom(prev => ({ ...prev, [field]: value }))
    setValidationError(null)
  }, [])

  const handleFetchCustomModels = useCallback(async () => {
    const errorKey = getCustomConfigErrorForPurpose(custom, keys.custom || '', 'models')
    if (errorKey) {
      setValidationError(errorKey)
      setCustomFetchError(formatCustomError(errorKey))
      return
    }

    setCustomFetchLoading(true)
    setCustomFetchError(null)
    try {
      const nextState: ProviderState = {
        activeProviderId: 'custom',
        activeModelId,
        keys,
        custom,
      }
      const models = await fetchCustomModels(nextState, keys.custom || '')
      setCustomFetchedModels(models)
      setCustomVisibleCount(12)
    } catch (error: any) {
      const message = error?.message || String(error)
      setCustomFetchError(formatCustomError(message))
    } finally {
      setCustomFetchLoading(false)
    }
  }, [activeModelId, custom, keys, formatCustomError])

  const validateCustom = useCallback((nextCustom: ProviderState['custom']) => {
    return getCustomConfigError(nextCustom, keys.custom || '')
  }, [keys])

  const handleVisionKeyChange = useCallback((providerId: string, key: string) => {
    setVisionProviderState((prev) => ({
      ...prev,
      keys: {
        ...prev.keys,
        [providerId]: key,
      },
    }))
  }, [])

  const handleVisionCustomChange = useCallback((field: keyof ProviderState['custom'], value: string) => {
    setVisionProviderState((prev) => ({
      ...prev,
      custom: {
        ...prev.custom,
        [field]: value,
      },
    }))
  }, [])

  const handleVisionProviderSelect = useCallback((providerId: string) => {
    const provider = getProvider(providerId)
    setVisionProviderState((prev) => ({
      ...prev,
      activeProviderId: providerId,
      activeModelId: providerId === 'custom'
        ? (prev.custom.modelId?.trim() || '')
        : (provider.models[0]?.id || ''),
    }))
  }, [])

  const handleVisionModelSelect = useCallback((modelId: string) => {
    setVisionProviderState((prev) => ({
      ...prev,
      activeModelId: modelId,
      custom: prev.activeProviderId === 'custom'
        ? { ...prev.custom, modelId }
        : prev.custom,
    }))
  }, [])

  const renderVisionRoutingSection = () => (
    <>
      <div className="pm-section-label">{t('provider.section.vision')}</div>
      <label className="pm-vision-toggle">
        <input
          type="checkbox"
          checked={visionSupportEnabled}
          onChange={(e) => setVisionSupportEnabled(e.target.checked)}
        />
        <span className="pm-vision-toggle-copy">
          <span className="pm-vision-toggle-title">{t('provider.visionSupport')}</span>
          <span className="pm-vision-toggle-hint">
            {visionSupportEnabled ? t('provider.visionSupportOn') : t('provider.visionSupportOff')}
          </span>
        </span>
      </label>
      <p className="pm-help-text">{t('provider.visionSupportHint')}</p>

      {!visionSupportEnabled && (
        <div className="pm-vision-assist-panel">
          <div className="pm-section-label">{t('provider.section.visionAssist')}</div>
          <p className="pm-help-text">{t('provider.visionAnalyzer.desc')}</p>

          <label className="pm-field-block">
            <span className="pm-field-label">{t('provider.visionAnalyzer.provider')}</span>
            <select
              className="pm-select"
              value={visionProviderState.activeProviderId}
              onChange={(e) => handleVisionProviderSelect(e.target.value)}
            >
              {PROVIDERS.map((providerOption) => (
                <option key={providerOption.id} value={providerOption.id}>{providerOption.name}</option>
              ))}
            </select>
          </label>

          {activeVisionProvider.id === 'custom' ? (
            <>
              <div className="pm-mode-row">
                {CUSTOM_MODES.map((mode) => (
                  <button
                    key={`vision-${mode}`}
                    className={`pm-mode-btn ${visionProviderState.custom.mode === mode ? 'selected' : ''}`}
                    onClick={() => handleVisionCustomChange('mode', mode)}
                    type="button"
                  >
                    {t(`provider.mode.${mode}`)}
                  </button>
                ))}
              </div>

              {visionProviderState.custom.mode === 'openai' && (
                <div className="pm-field-stack">
                  <label className="pm-field-block">
                    <span className="pm-field-label">{t('provider.baseUrl')}</span>
                    <input
                      type="text"
                      className="pm-key-input"
                      value={visionProviderState.custom.baseUrl || ''}
                      onChange={(e) => handleVisionCustomChange('baseUrl', e.target.value)}
                      placeholder={t('provider.baseUrl.placeholder.openai')}
                      spellCheck={false}
                    />
                  </label>
                </div>
              )}

              {visionProviderState.custom.mode === 'azure' && (
                <div className="pm-field-grid">
                  <label className="pm-field-block pm-field-span-2">
                    <span className="pm-field-label">{t('provider.resourceUrl')}</span>
                    <input
                      type="text"
                      className="pm-key-input"
                      value={visionProviderState.custom.resourceUrl || ''}
                      onChange={(e) => handleVisionCustomChange('resourceUrl', e.target.value)}
                      placeholder={t('provider.resourceUrl.placeholder.azure')}
                      spellCheck={false}
                    />
                  </label>
                  <label className="pm-field-block">
                    <span className="pm-field-label">{t('provider.deployment')}</span>
                    <input
                      type="text"
                      className="pm-key-input"
                      value={visionProviderState.custom.deployment || ''}
                      onChange={(e) => handleVisionCustomChange('deployment', e.target.value)}
                      placeholder={t('provider.deployment.placeholder.azure')}
                      spellCheck={false}
                    />
                  </label>
                  <label className="pm-field-block">
                    <span className="pm-field-label">{t('provider.apiVersion')}</span>
                    <input
                      type="text"
                      className="pm-key-input"
                      value={visionProviderState.custom.apiVersion || ''}
                      onChange={(e) => handleVisionCustomChange('apiVersion', e.target.value)}
                      placeholder={t('provider.apiVersion.placeholder.azure')}
                      spellCheck={false}
                    />
                  </label>
                </div>
              )}

              {visionProviderState.custom.mode === 'compatible' && (
                <div className="pm-field-stack">
                  <label className="pm-field-block">
                    <span className="pm-field-label">{t('provider.endpoint')}</span>
                    <input
                      type="text"
                      className="pm-key-input"
                      value={visionProviderState.custom.endpoint || ''}
                      onChange={(e) => handleVisionCustomChange('endpoint', e.target.value)}
                      placeholder={t('provider.endpoint.placeholder.compatible')}
                      spellCheck={false}
                    />
                  </label>
                </div>
              )}
            </>
          ) : null}

          <div className="pm-card-key-row">
            <input
              type="password"
              className="pm-key-input"
              value={visionProviderState.keys[activeVisionProvider.id] || ''}
              onChange={(e) => handleVisionKeyChange(activeVisionProvider.id, e.target.value)}
              placeholder={t(activeVisionProvider.keyHintKey)}
              spellCheck={false}
            />
          </div>

          <p className="pm-help-text">
            {t('provider.visionAnalyzer.supportsImages')}: {activeVisionModelSupportsImages ? t('common.yes') : t('common.no')}
          </p>

          {activeVisionProvider.id === 'custom' ? (
            <div className="pm-manual-row">
              <input
                type="text"
                className="pm-manual-input"
                value={visionProviderState.custom.modelId || ''}
                onChange={(e) => handleVisionCustomChange('modelId', e.target.value)}
                placeholder={t('provider.model.placeholder')}
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="pm-custom-model-list">
              {activeVisionProvider.models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={`pm-model-btn ${activeVisionModelId === model.id ? 'selected' : ''}`}
                  onClick={() => handleVisionModelSelect(model.id)}
                >
                  {model.label}
                  {model.vision && <span className="pm-vision-tag">V</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  const handleSave = useCallback(() => {
    const nextCustom = {
      mode: custom.mode,
      baseUrl: custom.baseUrl?.trim() || '',
      endpoint: custom.endpoint?.trim() || '',
      modelId: custom.modelId?.trim() || '',
      resourceUrl: custom.resourceUrl?.trim() || '',
      deployment: custom.deployment?.trim() || '',
      apiVersion: custom.apiVersion?.trim() || '',
    }

    if (activeProviderId === 'custom') {
      const errorKey = validateCustom(nextCustom)
      if (errorKey) {
        setValidationError(errorKey)
        return
      }
    }

    onUpdate({
      activeProviderId,
      activeModelId: activeProviderId === 'custom' ? (nextCustom.modelId || '') : activeModelId,
      keys,
      custom: nextCustom,
    })

    onUpdateVisionState(visionProviderState)
    onUpdateVisionSupportMap({
      ...visionSupportMap,
      [getProviderModelKey(activeProviderId, activeProviderId === 'custom' ? (nextCustom.modelId || activeModelId) : activeModelId, activeProviderId === 'custom' ? nextCustom : undefined)]: visionSupportEnabled,
    })
    onClose()
  }, [activeProviderId, activeModelId, custom, keys, onClose, onUpdate, onUpdateVisionState, onUpdateVisionSupportMap, validateCustom, visionProviderState, visionSupportEnabled, visionSupportMap])

  const getKeyStatus = (providerId: string): 'none' | 'set' | 'active' => {
    const key = keys[providerId] || ''
    if (key.length <= 4) return 'none'
    if (providerId === activeProviderId) return 'active'
    return 'set'
  }

  // Get models to display for a provider
  const getDisplayModels = (provider: ProviderDef): ModelDef[] => {
    if (provider.id === 'openrouter' && fetchedModels) {
      const query = modelSearch.toLowerCase()
      if (query) {
        return fetchedModels.filter(m =>
          m.id.toLowerCase().includes(query) || m.label.toLowerCase().includes(query)
        ).slice(0, 30)
      }
      // Default: show curated list
      return provider.models
    }
    return provider.models
  }

  const activeFooterModel = activeProviderId === 'custom'
    ? (custom.mode === 'azure'
      ? (custom.deployment?.trim() || custom.modelId?.trim() || '—')
      : (custom.modelId?.trim() || '—'))
    : (activeProvider.models.find(m => m.id === activeModelId)?.label || activeModelId)

  const filteredCustomModels = (customFetchedModels || []).filter((model) => {
    const query = customModelSearch.trim().toLowerCase()
    if (!query) return true
    return model.id.toLowerCase().includes(query) || model.label.toLowerCase().includes(query)
  })
  const visibleCustomModels = filteredCustomModels.slice(0, customVisibleCount)

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <h2 className="pm-title">{t('provider.title')}</h2>
          <button className="pm-close" onClick={onClose}>&times;</button>
        </div>

        <div className="pm-body">
          <div className="pm-cards">
            {PROVIDERS.map((provider) => {
              const isActive = provider.id === activeProviderId
              const keyStatus = getKeyStatus(provider.id)
              const key = keys[provider.id] || ''
              const displayModels = isActive ? getDisplayModels(provider) : []

              return (
                <div
                  key={provider.id}
                  className={`pm-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectProvider(provider)}
                >
                  <div className="pm-card-header">
                    <div className="pm-card-name-row">
                      <span className={`pm-card-dot ${keyStatus}`} />
                      <span className="pm-card-name">{provider.name}</span>
                      {provider.id === 'custom' && <span className="pm-card-tag">{t('provider.openaiCompat')}</span>}
                    </div>
                    {isActive && <span className="pm-card-active-badge">{t('provider.active')}</span>}
                  </div>

                  {!provider.customConfig && (
                    <div className="pm-card-key-row" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="password"
                        className="pm-key-input"
                        value={key}
                        onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                        placeholder={t(provider.keyHintKey)}
                        spellCheck={false}
                      />
                      {provider.keyUrl && (
                        <a
                          className="pm-key-link"
                          href={provider.keyUrl}
                          target="_blank"
                          rel="noopener"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('provider.getKey')} · {provider.keyUrlLabel} &rarr;
                        </a>
                      )}
                    </div>
                  )}

                  {isActive && !provider.customConfig && (
                    <div className="pm-card-models" onClick={(e) => e.stopPropagation()}>
                      {provider.fetchModels && (
                        <div className="pm-model-search-row">
                          <input
                            type="text"
                            className="pm-model-search"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            placeholder={t('provider.searchVisionModels')}
                            spellCheck={false}
                          />
                          {fetchLoading && <span className="pm-fetch-status">{t('provider.loading')}</span>}
                          {fetchError && <span className="pm-fetch-error">{t('provider.errorShort')}</span>}
                          {fetchedModels && !modelSearch && (
                            <span className="pm-fetch-status">{t('provider.modelsCount', { count: fetchedModels.length })}</span>
                          )}
                        </div>
                      )}

                      {displayModels.map((model) => (
                        <button
                          key={model.id}
                          className={`pm-model-btn ${activeModelId === model.id ? 'selected' : ''}`}
                          onClick={() => handleSelectModel(model.id)}
                          title={model.id}
                        >
                          {model.label}
                          {model.vision && <span className="pm-vision-tag">V</span>}
                        </button>
                      ))}

                      {!showManualInput ? (
                        <button
                          className="pm-model-btn pm-manual-btn"
                          onClick={() => setShowManualInput(true)}
                        >
                          {t('provider.customId')}
                        </button>
                      ) : (
                        <div className="pm-manual-row">
                          <input
                            type="text"
                            className="pm-manual-input"
                            value={manualModelId}
                            onChange={(e) => setManualModelId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualModelSubmit()}
                            placeholder={t('provider.typeModelId')}
                            spellCheck={false}
                            autoFocus
                          />
                          <button className="btn btn-primary pm-manual-go" onClick={handleManualModelSubmit}>
                            {t('provider.use')}
                          </button>
                        </div>
                      )}

                      {activeModelId && !displayModels.find(m => m.id === activeModelId) && !provider.models.find(m => m.id === activeModelId) && (
                        <div className="pm-custom-model-active">
                          {t('provider.usingModel', { model: activeModelId })} <span className="pm-custom-model-id">{activeModelId}</span>
                        </div>
                      )}
                      {renderVisionRoutingSection()}
                    </div>
                  )}

                  {isActive && provider.customConfig && (
                    <div className="pm-custom-panel" onClick={(e) => e.stopPropagation()}>
                      <div className="pm-section-label">{t('provider.section.connection')}</div>
                      <div className="pm-mode-row">
                        {CUSTOM_MODES.map((mode) => (
                          <button
                            key={mode}
                            className={`pm-mode-btn ${custom.mode === mode ? 'selected' : ''}`}
                            onClick={() => handleCustomChange('mode', mode)}
                            type="button"
                          >
                            {t(`provider.mode.${mode}`)}
                          </button>
                        ))}
                      </div>

                      {custom.mode === 'openai' && (
                        <div className="pm-field-stack">
                          <label className="pm-field-block">
                            <span className="pm-field-label">{t('provider.baseUrl')}</span>
                            <input
                              type="text"
                              className="pm-key-input"
                              value={custom.baseUrl || ''}
                              onChange={(e) => handleCustomChange('baseUrl', e.target.value)}
                              placeholder={t('provider.baseUrl.placeholder.openai')}
                              spellCheck={false}
                            />
                          </label>
                        </div>
                      )}

                      {custom.mode === 'azure' && (
                        <div className="pm-field-grid">
                          <label className="pm-field-block pm-field-span-2">
                            <span className="pm-field-label">{t('provider.resourceUrl')}</span>
                            <input
                              type="text"
                              className="pm-key-input"
                              value={custom.resourceUrl || ''}
                              onChange={(e) => handleCustomChange('resourceUrl', e.target.value)}
                              placeholder={t('provider.resourceUrl.placeholder.azure')}
                              spellCheck={false}
                            />
                          </label>
                          <label className="pm-field-block">
                            <span className="pm-field-label">{t('provider.deployment')}</span>
                            <input
                              type="text"
                              className="pm-key-input"
                              value={custom.deployment || ''}
                              onChange={(e) => handleCustomChange('deployment', e.target.value)}
                              placeholder={t('provider.deployment.placeholder.azure')}
                              spellCheck={false}
                            />
                          </label>
                          <label className="pm-field-block">
                            <span className="pm-field-label">{t('provider.apiVersion')}</span>
                            <input
                              type="text"
                              className="pm-key-input"
                              value={custom.apiVersion || ''}
                              onChange={(e) => handleCustomChange('apiVersion', e.target.value)}
                              placeholder={t('provider.apiVersion.placeholder.azure')}
                              spellCheck={false}
                            />
                          </label>
                        </div>
                      )}

                      {custom.mode === 'compatible' && (
                        <div className="pm-field-stack">
                          <label className="pm-field-block">
                            <span className="pm-field-label">{t('provider.endpoint')}</span>
                            <input
                              type="text"
                              className="pm-key-input"
                              value={custom.endpoint || ''}
                              onChange={(e) => handleCustomChange('endpoint', e.target.value)}
                              placeholder={t('provider.endpoint.placeholder.compatible')}
                              spellCheck={false}
                            />
                          </label>
                        </div>
                      )}

                      <div className="pm-section-label">{t('provider.section.auth')}</div>
                      <div className="pm-card-key-row">
                        <input
                          type="password"
                          className="pm-key-input"
                          value={key}
                          onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                          placeholder={t('provider.key.placeholder')}
                          spellCheck={false}
                        />
                      </div>

                      <div className="pm-section-label">{t('provider.section.models')}</div>
                      <div className="pm-model-search-row">
                        <input
                          type="text"
                          className="pm-model-search"
                          value={customModelSearch}
                          onChange={(e) => {
                            setCustomModelSearch(e.target.value)
                            setCustomVisibleCount(12)
                          }}
                          placeholder={t('provider.modelSearch.placeholder')}
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          className="pm-fetch-models-btn"
                          onClick={handleFetchCustomModels}
                          disabled={customFetchLoading}
                        >
                          {customFetchLoading ? t('provider.loading') : customFetchedModels ? t('provider.fetchModelsRetry') : t('provider.fetchModels')}
                        </button>
                      </div>
                      {visibleCustomModels.length > 0 && (
                        <div className="pm-custom-model-list">
                          {visibleCustomModels.map((model) => (
                            <button
                              key={model.id}
                              type="button"
                              className={`pm-model-btn ${custom.modelId === model.id ? 'selected' : ''}`}
                              onClick={() => {
                                handleCustomChange('modelId', model.id)
                                setActiveModelId(model.id)
                                setVisionSupportEnabled(isModelVisionEnabled(provider, model.id, visionSupportMap, {
                                  ...custom,
                                  modelId: model.id,
                                }))
                              }}
                              title={model.id}
                            >
                              {model.label}
                              {model.vision && <span className="pm-vision-tag">V</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {customFetchedModels && filteredCustomModels.length === 0 && (
                        <div className="pm-help-text">{t('provider.modelsEmpty')}</div>
                      )}
                      {!customFetchedModels && !customFetchLoading && !customFetchError && (
                        <div className="pm-help-text">{t('provider.modelsUnavailable')}</div>
                      )}
                      {filteredCustomModels.length > visibleCustomModels.length && (
                        <button
                          type="button"
                          className="pm-show-more-btn"
                          onClick={() => setCustomVisibleCount((count) => count + 12)}
                        >
                          {t('provider.showMoreModels')} ({filteredCustomModels.length - visibleCustomModels.length})
                        </button>
                      )}
                      {customFetchError && <div className="pm-validation">{customFetchError}</div>}
                      <div className="pm-manual-row">
                        <input
                          type="text"
                          className="pm-manual-input"
                          value={custom.modelId || ''}
                          onChange={(e) => {
                            handleCustomChange('modelId', e.target.value)
                            setActiveModelId(e.target.value)
                            setVisionSupportEnabled(isModelVisionEnabled(provider, e.target.value, visionSupportMap, {
                              ...custom,
                              modelId: e.target.value,
                            }))
                          }}
                          placeholder={t('provider.model.placeholder')}
                          spellCheck={false}
                        />
                      </div>

                      {renderVisionRoutingSection()}

                      <div className="pm-section-label">{t('provider.section.notes')}</div>
                      <p className="pm-note">
                        {custom.mode === 'openai' && t('provider.note.openai')}
                        {custom.mode === 'azure' && t('provider.note.azure')}
                        {custom.mode === 'compatible' && t('provider.note.compatible')}
                      </p>
                      <p className="pm-note pm-note-secondary">{t('provider.proxyHint')}</p>

                      {validationError && <div className="pm-validation">{t(validationError)}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="pm-footer">
          <div className="pm-footer-info">
            <span className="pm-footer-provider">{activeProvider.name}</span>
            <span className="pm-footer-sep">/</span>
            <span className="pm-footer-model">{activeFooterModel}</span>
          </div>
          <div className="pm-footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>{t('provider.cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave}>{t('provider.save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
