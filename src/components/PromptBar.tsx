import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import type { Translate } from '../lib/i18n'
import type { CanvasModeDefinition } from '../lib/canvasModes'
import {
  BRAND_STYLE_PRESETS,
  DENSITY_OPTIONS,
  FIDELITY_OPTIONS,
  MOTION_OPTIONS,
  SURFACE_OPTIONS,
  TONE_OPTIONS,
  WORKFLOW_PRESETS,
  type BrandStyleId,
  type PromptStudioState,
} from '../lib/promptPresets'
import './PromptBar.css'

const INSPIRATION = [
  { labelKey: 'prompt.inspiration.generativeArt', prompt: 'As a master of creative programming, create an interactive generative art piece with given reference image as direction / inspiration. You may use canvas2d, shader, p5.js or similar.' },
  { labelKey: 'prompt.inspiration.wireframe', prompt: 'As a frontend expert, turn this wireframe into a polished, production-ready web application with clean UI and good UX, take reference image as direction & inspiration.' },
  { labelKey: 'prompt.inspiration.landing', prompt: 'As a frontend expert, Build a modern SaaS landing page with hero, features, pricing, and CTA sections, make use of stock CSS and Font library instead of improvising.' },
  { labelKey: 'prompt.inspiration.dashboard', prompt: 'Create a data dashboard with charts, stats cards, and a clean sidebar navigation' }
]

interface Props {
  modeDefinition: CanvasModeDefinition
  onGenerate: (prompt: string) => void
  onRefine: (prompt: string) => void
  onClear: () => void
  onSurprise: (currentPrompt: string) => void
  prompt: string
  onPromptChange: (value: string) => void
  studio: PromptStudioState
  onStudioChange: (state: PromptStudioState) => void
  onOpenLibrary: () => void
  fineTuneExpanded: boolean
  onFineTuneToggle: () => void
  remixUrl: string
  onRemixUrlChange: (value: string) => void
  onFetchRemixReference: () => void
  remixFetchLoading: boolean
  remixFetchError: string | null
  hasWebsiteReference: boolean
  websiteReferenceSummary: string
  onClearWebsiteReference: () => void
  hasOutput: boolean
  previousRoundAvailable: boolean
  includePreviousRoundContext: boolean
  onIncludePreviousRoundContextChange: (value: boolean) => void
  generating: boolean
  planMode: boolean
  onPlanModeToggle: () => void
  hasKey: boolean
  t: Translate
}

export function PromptBar({
  modeDefinition,
  onGenerate,
  onRefine,
  onClear,
  onSurprise,
  prompt,
  onPromptChange,
  studio,
  onStudioChange,
  onOpenLibrary,
  fineTuneExpanded,
  onFineTuneToggle,
  remixUrl,
  onRemixUrlChange,
  onFetchRemixReference,
  remixFetchLoading,
  remixFetchError,
  hasWebsiteReference,
  websiteReferenceSummary,
  onClearWebsiteReference,
  hasOutput,
  previousRoundAvailable,
  includePreviousRoundContext,
  onIncludePreviousRoundContextChange,
  generating,
  planMode,
  onPlanModeToggle,
  hasKey,
  t,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isClassicMode = modeDefinition.id === 'classic-studio'
  const isRemixMode = modeDefinition.id === 'remix'
  const [modeToolsOpen, setModeToolsOpen] = useState(false)

  const selectedWorkflow = useMemo(
    () => WORKFLOW_PRESETS.find((preset) => preset.id === studio.workflowId) || WORKFLOW_PRESETS[0],
    [studio.workflowId],
  )

  useEffect(() => {
    setModeToolsOpen(false)
  }, [modeDefinition.id])

  const applyStudioPatch = useCallback((patch: Partial<PromptStudioState>) => {
    onStudioChange({ ...studio, ...patch })
  }, [onStudioChange, studio])

  const toggleStyle = useCallback((styleId: BrandStyleId) => {
    const next = studio.styleIds.includes(styleId)
      ? studio.styleIds.filter((id) => id !== styleId)
      : [...studio.styleIds, styleId].slice(0, 3)

    if (next.length === 0) return
    applyStudioPatch({ styleIds: next })
  }, [applyStudioPatch, studio.styleIds])

  const handleSubmit = useCallback(() => {
    const text = prompt.trim()
    if (generating) return
    if (hasOutput) {
      onRefine(text)
    } else {
      if (isRemixMode && !hasWebsiteReference) return
      if (!text && !(isRemixMode && hasWebsiteReference)) return
      onGenerate(text)
    }
    onPromptChange('')
  }, [prompt, generating, hasOutput, onGenerate, onRefine, onPromptChange, isRemixMode, hasWebsiteReference])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleInspiration = useCallback((text: string) => {
    onPromptChange(text)
    textareaRef.current?.focus()
  }, [onPromptChange])

  const handleSurprise = useCallback(() => {
    onSurprise(prompt)
    textareaRef.current?.focus()
  }, [onSurprise, prompt])

  const studioPanel = (
    <div className="studio-panel">
      <div className="studio-row studio-row-primary">
        <div className="studio-section">
          <div className="studio-label-row">
            <span className="studio-label">{t('studio.workflow.label')}</span>
            <div className="studio-meta-row">
              <span className="studio-meta">{t(selectedWorkflow.descriptionKey)}</span>
              <button className="btn btn-secondary studio-library-btn" type="button" onClick={onOpenLibrary}>
                {t('preset.library.open')}
              </button>
            </div>
          </div>
          <div className="studio-chip-strip">
            {WORKFLOW_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`studio-chip ${studio.workflowId === preset.id ? 'selected' : ''}`}
                onClick={() => applyStudioPatch({ workflowId: preset.id })}
                disabled={generating}
              >
                {t(preset.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="studio-row">
        <div className="studio-section">
          <div className="studio-label-row">
            <span className="studio-label">{t('studio.style.label')}</span>
            <span className="studio-meta">{t('studio.style.meta')}</span>
          </div>
          <div className="studio-chip-strip">
            {BRAND_STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`studio-chip ${studio.styleIds.includes(preset.id) ? 'selected' : ''}`}
                onClick={() => toggleStyle(preset.id)}
                disabled={generating}
              >
                {t(preset.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="studio-grid">
        <label className="studio-select-block">
          <span className="studio-label">{t('studio.surface.label')}</span>
          <select
            className="studio-select"
            value={studio.surface}
            onChange={(e) => applyStudioPatch({ surface: e.target.value as PromptStudioState['surface'] })}
            disabled={generating}
          >
            {SURFACE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>

        <label className="studio-select-block">
          <span className="studio-label">{t('studio.tone.label')}</span>
          <select
            className="studio-select"
            value={studio.tone}
            onChange={(e) => applyStudioPatch({ tone: e.target.value as PromptStudioState['tone'] })}
            disabled={generating}
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>

        <label className="studio-select-block">
          <span className="studio-label">{t('studio.density.label')}</span>
          <select
            className="studio-select"
            value={studio.density}
            onChange={(e) => applyStudioPatch({ density: e.target.value as PromptStudioState['density'] })}
            disabled={generating}
          >
            {DENSITY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>

        <label className="studio-select-block">
          <span className="studio-label">{t('studio.motion.label')}</span>
          <select
            className="studio-select"
            value={studio.motion}
            onChange={(e) => applyStudioPatch({ motion: e.target.value as PromptStudioState['motion'] })}
            disabled={generating}
          >
            {MOTION_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>

        <label className="studio-select-block">
          <span className="studio-label">{t('studio.fidelity.label')}</span>
          <select
            className="studio-select"
            value={studio.fidelity}
            onChange={(e) => applyStudioPatch({ fidelity: e.target.value as PromptStudioState['fidelity'] })}
            disabled={generating}
          >
            {FIDELITY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )

  const classicDrawer = (
    <>
      <div className="mode-compact-bar classic-compact-bar">
        <div className="mode-compact-copy">
          <span className="mode-compact-pill">{t(modeDefinition.labelKey)}</span>
        </div>
        <button
          type="button"
          className={`btn btn-secondary mode-tools-toggle ${modeToolsOpen ? 'active' : ''}`}
          onClick={() => setModeToolsOpen((prev) => !prev)}
          disabled={generating}
        >
          {modeToolsOpen ? t('mode.tools.close') : t('mode.tools.open')}
        </button>
      </div>

      {modeToolsOpen && (
        <div className="mode-drawer classic-mode-drawer">
          {!hasOutput && !prompt && (
            <div className="inspiration-strip">
              {INSPIRATION.map((item) => (
                <button
                  key={item.labelKey}
                  className="inspiration-chip"
                  onClick={() => handleInspiration(item.prompt)}
                  disabled={generating}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          )}
          {studioPanel}
        </div>
      )}
    </>
  )

  return (
    <div className={`prompt-bar ${planMode ? 'plan-active' : ''} ${isClassicMode ? 'mode-classic' : 'mode-guided'}`}>
      {isClassicMode ? (
        classicDrawer
      ) : (
        <>
          {isRemixMode && (
            <div className="remix-url-panel">
              <div className="remix-url-row">
                <input
                  type="text"
                  className="remix-url-input"
                  value={remixUrl}
                  onChange={(e) => onRemixUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onFetchRemixReference()
                    }
                  }}
                  placeholder={t('mode.remix.urlPlaceholder')}
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn btn-primary remix-fetch-btn"
                  onClick={onFetchRemixReference}
                  disabled={remixFetchLoading}
                >
                  {remixFetchLoading ? t('mode.remix.fetching') : t('mode.remix.fetch')}
                </button>
              </div>
              <div className="remix-reference-row">
                <span className={`remix-reference-status ${hasWebsiteReference ? 'ready' : 'idle'}`}>
                  {hasWebsiteReference ? websiteReferenceSummary : t('mode.remix.referenceMissing')}
                </span>
                {hasWebsiteReference && (
                  <button
                    type="button"
                    className="btn btn-ghost remix-clear-btn"
                    onClick={onClearWebsiteReference}
                    disabled={generating}
                  >
                    {t('mode.remix.clear')}
                  </button>
                )}
              </div>
              {remixFetchError && <div className="remix-error">{remixFetchError}</div>}
            </div>
          )}

          <div className="mode-compact-bar">
            <div className="mode-compact-copy">
              <span className="mode-compact-pill">{t(modeDefinition.labelKey)}</span>
            </div>
            <button
              type="button"
              className={`btn btn-secondary mode-tools-toggle ${modeToolsOpen ? 'active' : ''}`}
              onClick={() => setModeToolsOpen((prev) => !prev)}
              disabled={generating}
            >
              {modeToolsOpen ? t('mode.tools.close') : t('mode.tools.open')}
            </button>
          </div>

          {modeToolsOpen && (
            <div className="mode-drawer">
              <div className="mode-drawer-header">
                <div className="mode-drawer-copy">
                  <span className="mode-drawer-label">{t(modeDefinition.labelKey)}</span>
                  <p className="mode-drawer-summary">{t(modeDefinition.summaryKey)}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary mode-surprise-btn"
                  onClick={handleSurprise}
                  disabled={generating}
                >
                  {t(modeDefinition.ui.surpriseLabelKey)}
                </button>
              </div>
              <div className="studio-chip-strip mode-starter-strip">
                {modeDefinition.starterPrompts.map((starter) => (
                  <button
                    key={starter.labelKey}
                    type="button"
                    className="studio-chip mode-starter-chip"
                    onClick={() => handleInspiration(starter.prompt)}
                    disabled={generating}
                  >
                    {t(starter.labelKey)}
                  </button>
                ))}
              </div>

              {isRemixMode && hasWebsiteReference && (
                <div className="remix-drawer-note">
                  {t('mode.remix.referenceReady')}
                </div>
              )}

              <div className="fine-tune-row">
                <button
                  type="button"
                  className={`btn btn-secondary fine-tune-toggle ${fineTuneExpanded ? 'expanded' : ''}`}
                  onClick={onFineTuneToggle}
                  disabled={generating}
                >
                  {t(modeDefinition.ui.fineTuneLabelKey)}
                </button>
                <span className="studio-meta">{t(modeDefinition.ui.fineTuneHintKey)}</span>
              </div>
              {fineTuneExpanded && studioPanel}
            </div>
          )}
        </>
      )}

      <textarea
        ref={textareaRef}
        className="prompt-input"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={hasOutput
          ? t(modeDefinition.ui.refinePlaceholderKey)
          : t(modeDefinition.ui.generatePlaceholderKey)
        }
        rows={4}
        disabled={generating}
      />

      {hasOutput && previousRoundAvailable && (
        <label className={`context-toggle ${includePreviousRoundContext ? 'active' : ''}`}>
          <input
            type="checkbox"
            checked={includePreviousRoundContext}
            onChange={(e) => onIncludePreviousRoundContextChange(e.target.checked)}
            disabled={generating}
          />
          <span className="context-toggle-label">{t('prompt.includePreviousRound')}</span>
          <span className="context-toggle-hint">{t('prompt.includePreviousRoundHint')}</span>
        </label>
      )}

      <div className="prompt-footer">
        <button
          className={`plan-toggle ${planMode ? 'active' : ''}`}
          onClick={onPlanModeToggle}
          disabled={generating}
          title={planMode ? t('prompt.plan.title.on') : t('prompt.plan.title.off')}
        >
          <span className="plan-toggle-orb" />
          <span className="plan-toggle-label">{t('prompt.plan.label')}</span>
          {planMode && <span className="plan-toggle-hint">{t('prompt.plan.hint')}</span>}
        </button>

        <div className="prompt-footer-right">
          {hasOutput && (
            <button
              className="btn btn-ghost clear-btn"
              onClick={onClear}
              disabled={generating}
            >
              {t('prompt.clear')}
            </button>
          )}
          <button
            className={`btn btn-primary generate-btn ${planMode ? 'plan-active' : ''} ${!hasKey ? 'no-key' : ''}`}
            onClick={handleSubmit}
            disabled={!hasKey || generating || (!hasOutput && (isRemixMode ? !hasWebsiteReference : !prompt.trim()))}
          >
            {!hasKey ? (
              <>{t('prompt.noKey')}</>
            ) : generating ? (
              <span className="btn-spinner" />
            ) : hasOutput ? (
              <>{t(modeDefinition.ui.refineActionKey)}</>
            ) : (
              <>{t(modeDefinition.ui.generateActionKey)}</>
            )}
          </button>
          <span className="prompt-hint mono">{hasKey ? t('prompt.shortcut') : t('prompt.keyHint')}</span>
        </div>
      </div>
    </div>
  )
}
