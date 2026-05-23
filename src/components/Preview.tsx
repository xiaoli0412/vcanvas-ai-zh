import React from 'react'
import type { Translate } from '../lib/i18n'
import type { CanvasModeDefinition } from '../lib/canvasModes'
import './Preview.css'

interface Props {
  html: string
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  modeDefinition: CanvasModeDefinition
  t: Translate
}

export function Preview({ html, iframeRef, modeDefinition, t }: Props) {
  if (!html) {
    return (
      <div className="preview-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="m9 8 6 4-6 4Z" />
        </svg>
        <p>{t(modeDefinition.ui.previewEmptyKey)}</p>
        <span className="preview-hint">{t(modeDefinition.ui.previewHintKey)}</span>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      className="preview-frame"
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      title={t('preview.open')}
    />
  )
}
