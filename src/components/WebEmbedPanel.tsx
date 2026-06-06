import React, { useState } from 'react'
import type { Translate } from '../lib/i18n'
import type { WebEmbedReference } from '../lib/webEmbeds'
import './WebEmbedPanel.css'

interface Props {
  embeds: WebEmbedReference[]
  onReplace: (id: string, url: string) => void
  onRemove: (id: string) => void
  onStatusChange: (id: string, status: WebEmbedReference['status'], error?: string | null) => void
  onClose: () => void
  t: Translate
}

export function WebEmbedPanel({ embeds, onReplace, onRemove, onStatusChange, onClose, t }: Props) {
  const [activeId, setActiveId] = useState<string | null>(embeds[0]?.id || null)
  const [draftUrl, setDraftUrl] = useState('')

  if (!embeds.length) return null

  const activeEmbed = embeds.find((embed) => embed.id === activeId) || embeds[0]

  return (
    <div className="web-embed-panel">
      <div className="web-embed-header">
        <div>
          <span className="web-embed-title">{t('webEmbed.title')}</span>
          <span className="web-embed-note">{t('webEmbed.note')}</span>
        </div>
        <button className="btn btn-ghost web-embed-close" onClick={onClose} type="button">
          {t('common.close')}
        </button>
      </div>
      <div className="web-embed-row">
        <div className="web-embed-list">
          {embeds.map((embed) => (
            <button
              key={embed.id}
              className={`web-embed-chip ${embed.id === activeEmbed.id ? 'selected' : ''}`}
              onClick={() => {
                setActiveId(embed.id)
                setDraftUrl(embed.url)
              }}
              type="button"
              title={embed.url}
            >
              <span>{embed.title}</span>
              <small>{embed.status}</small>
            </button>
          ))}
        </div>
        <div className="web-embed-actions">
          <input
            className="web-embed-input"
            value={draftUrl || activeEmbed.url}
            onChange={(event) => setDraftUrl(event.target.value)}
            spellCheck={false}
          />
          <button className="btn btn-secondary" onClick={() => onReplace(activeEmbed.id, draftUrl || activeEmbed.url)}>
            {t('webEmbed.replace')}
          </button>
          <button className="btn btn-ghost" onClick={() => onRemove(activeEmbed.id)}>
            {t('webEmbed.remove')}
          </button>
        </div>
      </div>
      <div className="web-embed-preview">
        <iframe
          key={activeEmbed.url}
          src={activeEmbed.url}
          title={activeEmbed.title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => onStatusChange(activeEmbed.id, 'preview-ready', null)}
          onError={() => onStatusChange(activeEmbed.id, 'blocked', t('webEmbed.blocked'))}
        />
        {activeEmbed.status === 'blocked' || activeEmbed.status === 'error' ? (
          <div className="web-embed-fallback">
            <span>{activeEmbed.error || t('webEmbed.blocked')}</span>
            <a href={activeEmbed.url} target="_blank" rel="noopener">{t('webEmbed.open')}</a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
