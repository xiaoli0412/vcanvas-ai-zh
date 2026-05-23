import React, { useRef, useCallback, useMemo } from 'react'
import type { Translate } from '../lib/i18n'
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
  hasKey,
  t,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  return (
    <div className={`prompt-bar ${planMode ? 'plan-active' : ''}`}>
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

      <textarea
        ref={textareaRef}
        className="prompt-input"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={hasOutput
          ? t('prompt.placeholder.refine')
          : t('prompt.placeholder.generate')
        }
        rows={4}
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
