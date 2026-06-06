import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { Translate } from '../lib/i18n'
import { getSources, exportSourceAsPng, exportAllAsPng } from '../lib/export'
import type { SourceInfo } from '../lib/export'
import './FramePicker.css'

interface SourceThumb extends SourceInfo {
  thumbUrl: string | null
}

interface Props {
  editor: ExcalidrawImperativeAPI | null
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  onAddFrame: () => void
  onAddWebEmbed: () => void
  onManageWebEmbeds: () => void
  onOpenWorkCenter: () => void
  webEmbedCount: number
  canvasVersion: number
  onSave: () => void
  onLoad: () => void
  previewScreenshot: string | null
  t: Translate
}

export function FramePicker({ editor, selectedIds, onSelectionChange, onAddFrame, onAddWebEmbed, onManageWebEmbeds, onOpenWorkCenter, webEmbedCount, canvasVersion, onSave, onLoad, previewScreenshot, t }: Props) {
  const [sources, setSources] = useState<SourceThumb[]>([])
  const [hasDrawing, setHasDrawing] = useState(false)
  const prevCountRef = useRef(0)

  const refreshSources = useCallback(async () => {
    if (!editor) return
    const srcs = getSources(editor)
    const thumbs: SourceThumb[] = await Promise.all(
      srcs.map(async (s) => {
        const b64 = await exportSourceAsPng(editor, s.id)
        return {
          ...s,
          thumbUrl: b64 ? 'data:image/png;base64,' + b64 : null,
        }
      })
    )
    setSources(thumbs)

    if (thumbs.length > prevCountRef.current) {
      onSelectionChange(new Set(thumbs.map((s) => s.id)))
    }
    prevCountRef.current = thumbs.length

    const elements = editor.getSceneElements()
    setHasDrawing(elements.length > 0)
  }, [editor, onSelectionChange])

  useEffect(() => { refreshSources() }, [canvasVersion, refreshSources])

  const toggle = useCallback((id: string) => {
    onSelectionChange(
      selectedIds.has(id)
        ? new Set([...selectedIds].filter((x) => x !== id))
        : new Set([...selectedIds, id])
    )
  }, [selectedIds, onSelectionChange])

  const selectAll = useCallback(() => {
    onSelectionChange(new Set(sources.map((s) => s.id)))
  }, [sources, onSelectionChange])

  const selectNone = useCallback(() => {
    onSelectionChange(new Set())
  }, [onSelectionChange])

  const hasFrames = sources.some(s => s.kind === 'frame')

  // ── No frames: single-line status bar ──
  if (!hasFrames) {
    return (
      <div className="frame-picker-bar">
        <span className="fpb-status">
          <span className={`fpb-dot ${hasDrawing ? 'on' : ''}`} />
          {hasDrawing ? t('canvas.fullCanvasWillBeSent') : t('canvas.drawToStart')}
        </span>
        {previewScreenshot && (
          <span className="fpb-badge">{t('canvas.previousOutput')}</span>
        )}
        <div className="fpb-actions">
          <button className="btn btn-ghost" onClick={onAddFrame}>{t('canvas.frame')}</button>
          <button className="btn btn-ghost" onClick={onAddWebEmbed}>{t('webEmbed.add')}</button>
          {webEmbedCount > 0 && <button className="btn btn-ghost" onClick={onManageWebEmbeds}>{t('webEmbed.manage', { count: webEmbedCount })}</button>}
          <button className="btn btn-ghost" onClick={onOpenWorkCenter}>{t('works.open')}</button>
          <button className="btn btn-ghost" onClick={onSave}>{t('canvas.save')}</button>
          <button className="btn btn-ghost" onClick={onLoad}>{t('canvas.load')}</button>
        </div>
      </div>
    )
  }

  // ── Has frames: show thumbnail strip ──
  return (
    <div className="frame-picker">
      <div className="frame-picker-header">
        <span className="frame-picker-label">
          {t('canvas.sources')}
          <span className="frame-count">{selectedIds.size}/{sources.length}</span>
        </span>
        <div className="frame-picker-actions">
          <button className="btn btn-ghost" onClick={onAddFrame}>{t('canvas.frame')}</button>
          <button className="btn btn-ghost" onClick={onAddWebEmbed}>{t('webEmbed.add')}</button>
          {webEmbedCount > 0 && <button className="btn btn-ghost" onClick={onManageWebEmbeds}>{t('webEmbed.manage', { count: webEmbedCount })}</button>}
          <button className="btn btn-ghost" onClick={onOpenWorkCenter}>{t('works.open')}</button>
          <button className="btn btn-ghost" onClick={selectAll}>{t('canvas.all')}</button>
          <button className="btn btn-ghost" onClick={selectNone}>{t('canvas.none')}</button>
          <span className="fpb-sep" />
          <button className="btn btn-ghost" onClick={onSave}>{t('canvas.save')}</button>
          <button className="btn btn-ghost" onClick={onLoad}>{t('canvas.load')}</button>
        </div>
      </div>
      <div className="frame-picker-strip">
        {sources.map((s) => (
          <button
            key={s.id}
            className={`frame-thumb ${selectedIds.has(s.id) ? 'selected' : ''}`}
            onClick={() => toggle(s.id)}
            title={`${s.kind}: ${s.name}`}
          >
            {s.thumbUrl ? (
              <img src={s.thumbUrl} alt={s.name} />
            ) : (
              <div className="frame-thumb-empty" />
            )}
            <span className="frame-thumb-name">
              <span className="frame-thumb-kind">{s.kind === 'image' ? t('canvas.imageShort') : t('canvas.frameShort')}</span>
              {s.name}
            </span>
            {selectedIds.has(s.id) && <div className="frame-thumb-check">ok</div>}
          </button>
        ))}
        {previewScreenshot && (
          <div className="frame-thumb screenshot-thumb">
            <img src={previewScreenshot} alt={t('canvas.lastOutput')} />
            <span className="frame-thumb-name">
              <span className="frame-thumb-kind">{t('canvas.previewShort')}</span>
              {t('canvas.lastOutput')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
