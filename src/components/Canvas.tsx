import React, { useCallback } from 'react'
import { Excalidraw, THEME } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { Locale } from '../lib/i18n'
import './Canvas.css'

interface Props {
  onEditorReady: (api: ExcalidrawImperativeAPI) => void
  onCanvasChange?: () => void
  locale: Locale
}

export function Canvas({ onEditorReady, onCanvasChange, locale }: Props) {
  return (
    <div className="canvas-wrapper">
      <Excalidraw
        excalidrawAPI={onEditorReady}
        onChange={onCanvasChange}
        theme={THEME.DARK}
        langCode={locale}
        validateEmbeddable={(link) => /^https?:\/\//i.test(link)}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveToActiveFile: false,
            saveAsImage: false,
            clearCanvas: true,
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
        }}
      />
    </div>
  )
}
