import React from 'react'
import type { CanvasModeId } from '../../shared/contracts/publicServer'
import {
  CANVAS_MODE_GROUP_ORDER,
  type CanvasModeDefinition,
  type WorkflowContextPreferences,
  type RemixModeState,
} from '../lib/canvasModes'
import type { Translate } from '../lib/i18n'
import './ModePanel.css'

interface Props {
  visible: boolean
  activeModeId: CanvasModeId
  modes: CanvasModeDefinition[]
  contextPreferences: WorkflowContextPreferences
  remixState: RemixModeState | null
  onClose: () => void
  onModeChange: (modeId: CanvasModeId) => void
  onContextPreferencesChange: (next: WorkflowContextPreferences) => void
  onRemixUrlChange: (url: string) => void
  onFetchRemixReference: () => void
  fetchingRemixReference: boolean
  t: Translate
}

export function ModePanel({
  visible,
  activeModeId,
  modes,
  contextPreferences,
  remixState,
  onClose,
  onModeChange,
  onContextPreferencesChange,
  onRemixUrlChange,
  onFetchRemixReference,
  fetchingRemixReference,
  t,
}: Props) {
  if (!visible) return null

  const activeMode = modes.find((mode) => mode.id === activeModeId) || modes[0]
  const groupedModes = CANVAS_MODE_GROUP_ORDER
    .map((groupKey) => ({
      groupKey,
      modes: modes.filter((mode) => mode.groupKey === groupKey),
    }))
    .filter((group) => group.modes.length > 0)

  return (
    <div className="mode-panel-overlay" onClick={onClose}>
      <div className="mode-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mode-panel-header">
          <div>
            <div className="mode-panel-kicker">{t('mode.header')}</div>
            <h3 className="mode-panel-title">{t(activeMode.labelKey)}</h3>
            <p className="mode-panel-subtitle">{t(activeMode.summaryKey)}</p>
          </div>
          <button className="mode-panel-close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className="mode-panel-groups">
          {groupedModes.map((group) => (
            <section key={group.groupKey} className="mode-group">
              <div className="mode-group-title">{t(group.groupKey)}</div>
              <div className="mode-panel-grid">
                {group.modes.map((mode) => (
                  <button
                    key={mode.id}
                    className={`mode-card ${mode.id === activeModeId ? 'active' : ''}`}
                    onClick={() => onModeChange(mode.id)}
                    type="button"
                  >
                    <div className="mode-card-topline">
                      <span className="mode-card-title">{t(mode.labelKey)}</span>
                      {mode.badgeKey && <span className="mode-card-badge">{t(mode.badgeKey)}</span>}
                    </div>
                    <span className="mode-card-summary">{t(mode.summaryKey)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mode-panel-section">
          <div className="mode-section-head">
            <span className="mode-section-title">{t('mode.context.title')}</span>
            <span className="mode-section-note">{t('mode.context.note')}</span>
          </div>
          <div className="mode-context-grid">
            <label className="mode-context-item">
              <span>{t('mode.context.carry')}</span>
              <select
                value={contextPreferences.carryPolicy}
                onChange={(event) => onContextPreferencesChange({
                  ...contextPreferences,
                  carryPolicy: event.target.value as WorkflowContextPreferences['carryPolicy'],
                })}
              >
                <option value="disabled">{t('mode.context.disabled')}</option>
                <option value="last-turn">{t('mode.context.lastTurn')}</option>
                <option value="full">{t('mode.context.full')}</option>
              </select>
            </label>
            <label className="mode-toggle-item">
              <input
                type="checkbox"
                checked={contextPreferences.includePreviousPrompt}
                onChange={(event) => onContextPreferencesChange({
                  ...contextPreferences,
                  includePreviousPrompt: event.target.checked,
                })}
              />
              <span>{t('mode.context.prevPrompt')}</span>
            </label>
            <label className="mode-toggle-item">
              <input
                type="checkbox"
                checked={contextPreferences.includePreviousOutput}
                onChange={(event) => onContextPreferencesChange({
                  ...contextPreferences,
                  includePreviousOutput: event.target.checked,
                })}
              />
              <span>{t('mode.context.prevOutput')}</span>
            </label>
            <label className="mode-toggle-item">
              <input
                type="checkbox"
                checked={contextPreferences.includePreviousScreenshot}
                onChange={(event) => onContextPreferencesChange({
                  ...contextPreferences,
                  includePreviousScreenshot: event.target.checked,
                })}
              />
              <span>{t('mode.context.prevScreenshot')}</span>
            </label>
          </div>
        </div>

        {activeMode.requiresWebsiteReference && (
          <div className="mode-panel-section">
            <div className="mode-section-head">
              <span className="mode-section-title">{t('mode.remix.reference')}</span>
              <span className="mode-section-note">{t('mode.remix.referenceNote')}</span>
            </div>
            <div className="mode-remix-row">
              <input
                className="mode-remix-input"
                type="url"
                value={remixState?.url || ''}
                onChange={(event) => onRemixUrlChange(event.target.value)}
                placeholder={t('mode.remix.placeholder')}
                spellCheck={false}
              />
              <button className="btn btn-primary" onClick={onFetchRemixReference} disabled={fetchingRemixReference}>
                {fetchingRemixReference ? t('mode.remix.loading') : t('mode.remix.fetch')}
              </button>
            </div>
            {!!remixState?.styleHints.length && (
              <div className="mode-remix-hints">
                {remixState.styleHints.slice(0, 8).map((hint) => (
                  <span key={hint} className="mode-remix-chip">{hint}</span>
                ))}
              </div>
            )}
            {remixState?.error && <div className="mode-remix-error">{remixState.error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
