import React, { useMemo, useState } from 'react'
import type { Translate } from '../lib/i18n'
import {
  BUILT_IN_PROMPT_PRESETS,
  makePromptPresetCardView,
  type PromptPresetRecord,
} from '../lib/presetLibrary'
import './PresetLibraryModal.css'

interface Props {
  savedPresets: PromptPresetRecord[]
  onApply: (preset: PromptPresetRecord) => void
  onSaveCurrent: (name: string) => void
  onOverwrite: (presetId: string) => void
  onRename: (presetId: string, name: string) => void
  onDelete: (presetId: string) => void
  onClose: () => void
  t: Translate
}

export function PresetLibraryModal({
  savedPresets,
  onApply,
  onSaveCurrent,
  onOverwrite,
  onRename,
  onDelete,
  onClose,
  t,
}: Props) {
  const [newPresetName, setNewPresetName] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const builtInCards = useMemo(
    () => BUILT_IN_PROMPT_PRESETS.map((preset) => ({ preset, card: makePromptPresetCardView(preset, t) })),
    [t],
  )
  const savedCards = useMemo(
    () => savedPresets.map((preset) => ({ preset, card: makePromptPresetCardView(preset, t) })),
    [savedPresets, t],
  )

  const beginRename = (preset: PromptPresetRecord) => {
    setEditingPresetId(preset.id)
    setEditingName(preset.name)
  }

  const submitRename = () => {
    if (!editingPresetId || !editingName.trim()) return
    onRename(editingPresetId, editingName.trim())
    setEditingPresetId(null)
    setEditingName('')
  }

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pl-header">
          <div>
            <h2 className="pl-title">{t('preset.library.title')}</h2>
            <p className="pl-subtitle">{t('preset.library.subtitle')}</p>
          </div>
          <button className="pl-close" onClick={onClose}>&times;</button>
        </div>

        <div className="pl-body">
          <section className="pl-section">
            <div className="pl-section-head">
              <span className="pl-section-title">{t('preset.library.saveCurrent')}</span>
              <span className="pl-section-meta">{t('preset.library.localOnly')}</span>
            </div>
            <div className="pl-save-row">
              <input
                className="pl-input"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t('preset.library.namePlaceholder')}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!newPresetName.trim()) return
                  onSaveCurrent(newPresetName.trim())
                  setNewPresetName('')
                }}
              >
                {t('preset.action.saveAsNew')}
              </button>
            </div>
          </section>

          <section className="pl-section">
            <div className="pl-section-head">
              <span className="pl-section-title">{t('preset.library.builtIn')}</span>
              <span className="pl-section-meta">{t('preset.library.readOnly')}</span>
            </div>
            <div className="pl-grid">
              {builtInCards.map(({ preset, card }) => (
                <article key={preset.id} className="pl-card built-in">
                  <div className="pl-card-top">
                    <div>
                      <h3 className="pl-card-title">{card.name}</h3>
                      <div className="pl-card-summary">{card.summary}</div>
                    </div>
                    <span className="pl-badge">{t('preset.badge.builtIn')}</span>
                  </div>
                  <div className="pl-card-meta">{card.surface}</div>
                  <div className="pl-card-meta">{card.model}</div>
                  <p className="pl-card-preview">{card.promptPreview}</p>
                  <div className="pl-card-actions">
                    <button className="btn btn-primary" onClick={() => onApply(preset)}>{t('preset.action.apply')}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="pl-section">
            <div className="pl-section-head">
              <span className="pl-section-title">{t('preset.library.saved')}</span>
              <span className="pl-section-meta">{t('preset.library.savedCount', { count: savedCards.length })}</span>
            </div>
            {savedCards.length === 0 ? (
              <div className="pl-empty">{t('preset.library.empty')}</div>
            ) : (
              <div className="pl-grid">
                {savedCards.map(({ preset, card }) => (
                  <article key={preset.id} className="pl-card">
                    <div className="pl-card-top">
                      <div className="pl-card-title-wrap">
                        {editingPresetId === preset.id ? (
                          <div className="pl-rename-row">
                            <input
                              className="pl-input"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                            />
                            <button className="btn btn-primary" onClick={submitRename}>{t('preset.action.rename')}</button>
                          </div>
                        ) : (
                          <>
                            <h3 className="pl-card-title">{card.name}</h3>
                            <div className="pl-card-summary">{card.summary}</div>
                          </>
                        )}
                      </div>
                      <span className="pl-badge muted">{t('preset.badge.saved')}</span>
                    </div>
                    <div className="pl-card-meta">{card.surface}</div>
                    <div className="pl-card-meta">{card.model}</div>
                    <p className="pl-card-preview">{card.promptPreview}</p>
                    <div className="pl-card-actions">
                      <button className="btn btn-primary" onClick={() => onApply(preset)}>{t('preset.action.apply')}</button>
                      <button className="btn btn-secondary" onClick={() => onOverwrite(preset.id)}>{t('preset.action.overwrite')}</button>
                      <button className="btn btn-secondary" onClick={() => beginRename(preset)}>{t('preset.action.rename')}</button>
                      <button className="btn btn-ghost pl-delete" onClick={() => onDelete(preset.id)}>{t('preset.action.delete')}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
