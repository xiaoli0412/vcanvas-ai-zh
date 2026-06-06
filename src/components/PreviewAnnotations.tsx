import React, { useCallback, useMemo, useState } from 'react'
import type { Translate } from '../lib/i18n'
import {
  createPreviewAnnotation,
  type PreviewAnnotation,
} from '../lib/previewAnnotations'
import './PreviewAnnotations.css'

interface Props {
  active: boolean
  annotations: PreviewAnnotation[]
  onChange: (annotations: PreviewAnnotation[]) => void
  t: Translate
}

export function PreviewAnnotations({ active, annotations, onChange, t }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedId) || null,
    [annotations, selectedId],
  )

  const handleLayerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!active || event.target !== event.currentTarget) return

    const rect = event.currentTarget.getBoundingClientRect()
    const annotation = createPreviewAnnotation({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
    onChange([...annotations, annotation])
    setSelectedId(annotation.id)
  }, [active, annotations, onChange])

  const updateAnnotationText = useCallback((id: string, text: string) => {
    onChange(annotations.map((annotation) =>
      annotation.id === id ? { ...annotation, text } : annotation,
    ))
  }, [annotations, onChange])

  const removeAnnotation = useCallback((id: string) => {
    onChange(annotations.filter((annotation) => annotation.id !== id))
    setSelectedId((current) => current === id ? null : current)
  }, [annotations, onChange])

  if (!active && annotations.length === 0) return null

  return (
    <div
      className={`preview-annotation-layer ${active ? 'active' : ''}`}
      onClick={handleLayerClick}
      aria-label={t('preview.annotations.layer')}
    >
      {active && annotations.length === 0 && (
        <div className="preview-annotation-empty">{t('preview.annotations.empty')}</div>
      )}

      {annotations.map((annotation, index) => (
        <button
          key={annotation.id}
          className={`preview-annotation-pin ${annotation.id === selectedId ? 'selected' : ''}`}
          style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
          onClick={(event) => {
            event.stopPropagation()
            setSelectedId(annotation.id)
          }}
          type="button"
          aria-label={t('preview.annotations.pin', { index: index + 1 })}
        >
          {index + 1}
        </button>
      ))}

      {active && selectedAnnotation && (
        <div
          className={[
            'preview-annotation-editor',
            selectedAnnotation.x > 64 ? 'flip-x' : '',
            selectedAnnotation.y > 62 ? 'flip-y' : '',
          ].filter(Boolean).join(' ')}
          style={{ left: `${selectedAnnotation.x}%`, top: `${selectedAnnotation.y}%` }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="preview-annotation-editor-head">
            <span>{t('preview.annotations.editing')}</span>
            <button
              className="preview-annotation-icon-btn"
              onClick={() => setSelectedId(null)}
              type="button"
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>
          <textarea
            value={selectedAnnotation.text}
            onChange={(event) => updateAnnotationText(selectedAnnotation.id, event.target.value)}
            placeholder={t('preview.annotations.placeholder')}
            autoFocus
          />
          <div className="preview-annotation-editor-actions">
            <button
              className="btn btn-ghost"
              onClick={() => removeAnnotation(selectedAnnotation.id)}
              type="button"
            >
              {t('preview.annotations.delete')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setSelectedId(null)}
              type="button"
            >
              {t('preview.annotations.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
