import React, { useRef, useCallback, useMemo } from 'react'
import type { Translate } from '../lib/i18n'
import type { CanvasModeDefinition, WorkflowContextPreferences, RemixModeState } from '../lib/canvasModes'
import type { VideoReference } from '../lib/videoReferences'
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
  onGenerate: (prompt: string) => void
  onRefine: (prompt: string) => void
  onClear: () => void
  prompt: string
  onPromptChange: (value: string) => void
  studio: PromptStudioState
  onStudioChange: (state: PromptStudioState) => void
  onOpenLibrary: () => void
  hasOutput: boolean
  generating: boolean
  planMode: boolean
  onPlanModeToggle: () => void
  modeDefinition: CanvasModeDefinition
  compact: boolean
  fineTuneExpanded: boolean
  onToggleFineTune: () => void
  onSurprise: () => void
  contextPreferences: WorkflowContextPreferences
  onContextPreferencesChange: (next: WorkflowContextPreferences) => void
  remixState: RemixModeState | null
  onRemixUrlChange: (url: string) => void
  onFetchRemixReference: () => void
  fetchingRemixReference: boolean
  videoReference: VideoReference | null
  onVideoKeyframeToggle: (keyframeId: string) => void
  onClearVideoReference: () => void
  hasKey: boolean
  t: Translate
}

export function PromptBar({
  onGenerate,
  onRefine,
  onClear,
  prompt,
  onPromptChange,
  studio,
  onStudioChange,
  onOpenLibrary,
  hasOutput,
  generating,
  planMode,
  onPlanModeToggle,
  modeDefinition,
  compact,
  fineTuneExpanded,
  onToggleFineTune,
  onSurprise,
  contextPreferences,
  onContextPreferencesChange,
  remixState,
  onRemixUrlChange,
  onFetchRemixReference,
  fetchingRemixReference,
  videoReference,
  onVideoKeyframeToggle,
  onClearVideoReference,
  hasKey,
  t,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const showSecondaryControls = !compact || fineTuneExpanded
  const showStarterControls = !compact || fineTuneExpanded

  const selectedWorkflow = useMemo(
    () => WORKFLOW_PRESETS.find((preset) => preset.id === studio.workflowId) || WORKFLOW_PRESETS[0],
    [studio.workflowId],
  )

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
      if (!text) return
      onGenerate(text)
    }
    onPromptChange('')
  }, [prompt, generating, hasOutput, onGenerate, onRefine, onPromptChange])

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

  const compactStarterItems = useMemo(
    () => modeDefinition.starterPrompts.map((promptText, index) => ({
      labelKey: `mode.starter.${modeDefinition.id}.${index}`,
      prompt: promptText,
    })),
    [modeDefinition],
  )

  return (
    <div className={`prompt-bar ${planMode ? 'plan-active' : ''} ${compact ? 'compact' : ''}`}>
      {!hasOutput && !prompt && showStarterControls && (
        <div className="inspiration-strip">
          {(compact ? compactStarterItems : INSPIRATION).map((item) => (
            <button
              key={item.labelKey}
              className="inspiration-chip"
              onClick={() => handleInspiration(item.prompt)}
              disabled={generating}
            >
              {t(item.labelKey)}
            </button>
          ))}
          {compact && (
            <button className="inspiration-chip inspiration-chip-surprise" onClick={onSurprise} disabled={generating}>
              {t('mode.surprise')}
            </button>
          )}
        </div>
      )}

      {compact && fineTuneExpanded && (
        <div className="compact-mode-banner">
          <div>
            <span className="compact-mode-kicker">{t('mode.header')}</span>
            <div className="compact-mode-title">{t(modeDefinition.labelKey)}</div>
            <p className="compact-mode-summary">{t(modeDefinition.summaryKey)}</p>
          </div>
          <button className="btn btn-secondary compact-mode-toggle" onClick={onToggleFineTune} type="button">
            {fineTuneExpanded ? t('mode.fineTune.hide') : t('mode.fineTune.show')}
          </button>
        </div>
      )}

      {showSecondaryControls && (
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
      )}

      {showSecondaryControls && <div className="context-panel">
        <div className="context-header-row">
          <span className="studio-label">{t('mode.context.title')}</span>
          <button className="btn btn-ghost context-toggle-btn" onClick={onToggleFineTune} type="button">
            {t('mode.fineTune.hide')}
          </button>
        </div>
        <div className="context-grid">
          <label className="context-select-block">
            <span className="context-label">{t('mode.context.carry')}</span>
            <select
              className="studio-select"
              value={contextPreferences.carryPolicy}
              onChange={(e) => onContextPreferencesChange({
                ...contextPreferences,
                carryPolicy: e.target.value as WorkflowContextPreferences['carryPolicy'],
              })}
              disabled={generating}
            >
              <option value="disabled">{t('mode.context.disabled')}</option>
              <option value="last-turn">{t('mode.context.lastTurn')}</option>
              <option value="full">{t('mode.context.full')}</option>
            </select>
          </label>
          <label className="context-check">
            <input
              type="checkbox"
              checked={contextPreferences.includePreviousPrompt}
              onChange={(e) => onContextPreferencesChange({
                ...contextPreferences,
                includePreviousPrompt: e.target.checked,
              })}
              disabled={generating}
            />
            <span>{t('mode.context.prevPrompt')}</span>
          </label>
          <label className="context-check">
            <input
              type="checkbox"
              checked={contextPreferences.includePreviousOutput}
              onChange={(e) => onContextPreferencesChange({
                ...contextPreferences,
                includePreviousOutput: e.target.checked,
              })}
              disabled={generating}
            />
            <span>{t('mode.context.prevOutput')}</span>
          </label>
          <label className="context-check">
            <input
              type="checkbox"
              checked={contextPreferences.includePreviousScreenshot}
              onChange={(e) => onContextPreferencesChange({
                ...contextPreferences,
                includePreviousScreenshot: e.target.checked,
              })}
              disabled={generating}
            />
            <span>{t('mode.context.prevScreenshot')}</span>
          </label>
        </div>
      </div>}

      {showSecondaryControls && modeDefinition.requiresWebsiteReference && (
        <div className="context-panel remix-panel">
          <div className="context-header-row">
            <span className="studio-label">{t('mode.remix.reference')}</span>
            <span className="context-mini-copy">{t('mode.remix.referenceNote')}</span>
          </div>
          <div className="remix-reference-row">
            <input
              className="prompt-input remix-reference-input"
              value={remixState?.url || ''}
              onChange={(e) => onRemixUrlChange(e.target.value)}
              placeholder={t('mode.remix.placeholder')}
              disabled={generating}
            />
            <button className="btn btn-secondary" onClick={onFetchRemixReference} disabled={generating || fetchingRemixReference}>
              {fetchingRemixReference ? t('mode.remix.loading') : t('mode.remix.fetch')}
            </button>
          </div>
          {!!remixState?.styleHints.length && (
            <div className="remix-reference-hints">
              {remixState.styleHints.slice(0, 8).map((hint) => (
                <span key={hint} className="remix-reference-chip">{hint}</span>
              ))}
            </div>
          )}
          {remixState?.error && (
            <div className="remix-reference-error">{remixState.error}</div>
          )}
        </div>
      )}

      {showSecondaryControls && modeDefinition.id === 'video' && videoReference && (
        <div className="context-panel video-reference-panel">
          <div className="context-header-row">
            <span className="studio-label">{t('mode.video.reference')}</span>
            <span className="context-mini-copy">{videoReference.fileName}</span>
          </div>
          <div className="video-keyframe-strip">
            {videoReference.keyframes.map((keyframe, index) => {
              const selected = videoReference.selectedKeyframeIds.includes(keyframe.id)
              return (
                <button
                  key={keyframe.id}
                  className={`video-keyframe-chip ${selected ? 'selected' : ''}`}
                  onClick={() => onVideoKeyframeToggle(keyframe.id)}
                  disabled={generating}
                  type="button"
                  title={t('mode.video.keyframeTitle', { index: index + 1, time: keyframe.label })}
                >
                  <img src={keyframe.dataUrl} alt={t('mode.video.keyframeTitle', { index: index + 1, time: keyframe.label })} />
                  <span>{keyframe.label}</span>
                </button>
              )
            })}
            <button className="btn btn-ghost video-reference-clear" onClick={onClearVideoReference} disabled={generating} type="button">
              {t('mode.video.clear')}
            </button>
          </div>
          {videoReference.error && (
            <div className="remix-reference-error">{videoReference.error}</div>
          )}
          {!videoReference.error && videoReference.keyframes.length === 0 && (
            <div className="context-mini-copy">{t('mode.video.noKeyframes')}</div>
          )}
          <div className="context-mini-copy">{t('mode.video.referenceNote')}</div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="prompt-input"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={hasOutput
          ? t('prompt.placeholder.refine')
          : (compact ? t(modeDefinition.placeholderKey) : t('prompt.placeholder.generate'))
        }
        rows={compact ? 2 : 4}
        disabled={generating}
      />

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
        {compact && (
          <button className="btn btn-secondary compact-fine-tune-btn" onClick={onToggleFineTune} type="button">
            {fineTuneExpanded ? t('mode.fineTune.hide') : t('mode.fineTune.show')}
          </button>
        )}

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
            disabled={!hasKey || generating || (!hasOutput && !prompt.trim())}
          >
            {!hasKey ? (
              <>{t('prompt.noKey')}</>
            ) : generating ? (
              <span className="btn-spinner" />
            ) : hasOutput ? (
              <>{t('prompt.refine')}</>
            ) : (
              <>{t('prompt.generate')}</>
            )}
          </button>
          <span className="prompt-hint mono">{hasKey ? t('prompt.shortcut') : t('prompt.keyHint')}</span>
        </div>
      </div>
    </div>
  )
}
