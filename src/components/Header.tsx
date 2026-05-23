import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Locale, Translate } from '../lib/i18n'
import type { CanvasModeDefinition, CanvasModeId } from '../lib/canvasModes'
import './Header.css'

const PROJECT_REPOSITORY_URL = 'https://github.com/xiaoli0412/vcanvas-ai-zh'
const ORIGINAL_AUTHOR_URL = 'https://e01.ai'
const REPOSITORY_AUTHOR_URL = 'https://github.com/xiaoli0412'

interface Props {
  modes: CanvasModeDefinition[]
  modeId: CanvasModeId
  modeSummary: string
  providerName: string
  modelLabel: string
  studioSummary: string
  hasKey: boolean
  onModeChange: (modeId: CanvasModeId) => void
  onOpenSettings: () => void
  locale: Locale
  onToggleLocale: () => void
  t: Translate
}

export function Header({
  modes,
  modeId,
  modeSummary,
  providerName,
  modelLabel,
  studioSummary,
  hasKey,
  onModeChange,
  onOpenSettings,
  locale,
  onToggleLocale,
  t,
}: Props) {
  const [showAbout, setShowAbout] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  const modePopoverRef = useRef<HTMLDivElement>(null)
  const modeTriggerRef = useRef<HTMLButtonElement>(null)
  const [modeMenuStyle, setModeMenuStyle] = useState<React.CSSProperties>({})
  const activeMode = useMemo(
    () => modes.find((mode) => mode.id === modeId) ?? modes[0]!,
    [modeId, modes],
  )

  useEffect(() => {
    if (!showModeMenu) return

    const updatePosition = () => {
      const rect = modeTriggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = Math.min(360, window.innerWidth - 24)
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
      const top = Math.min(rect.bottom + 8, window.innerHeight - 80)

      setModeMenuStyle({
        position: 'fixed',
        top,
        left,
        width,
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        !modePopoverRef.current?.contains(event.target as Node)
        && !modeMenuRef.current?.contains(event.target as Node)
        && !modeTriggerRef.current?.contains(event.target as Node)
      ) {
        setShowModeMenu(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModeMenu(false)
      }
    }

    updatePosition()
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showModeMenu])

  useEffect(() => {
    if (showAbout) {
      setShowModeMenu(false)
    }
  }, [showAbout])

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <div className="header-title">
            <span className="header-title-main">V C A N V A S</span>
            <span className="header-sep">/</span>
            <span className="header-title-sub">PLAYGROUND</span>
            <span className="header-by">
              by <a href={ORIGINAL_AUTHOR_URL} target="_blank" rel="noopener" className="header-by-link">E01.ai</a>
              <span className="header-by-join"> × </span>
              <a href={REPOSITORY_AUTHOR_URL} target="_blank" rel="noopener" className="header-by-link">xiaoli0412</a>
            </span>
          </div>
          <div className={`header-mode-menu ${showModeMenu ? 'open' : ''}`} ref={modeMenuRef}>
            <button
              type="button"
              ref={modeTriggerRef}
              className="header-mode-trigger"
              aria-haspopup="menu"
              aria-expanded={showModeMenu}
              title={modeSummary}
              onClick={() => setShowModeMenu((prev) => !prev)}
            >
              <span className="header-mode-trigger-label">{t('mode.switcher.current')}</span>
              <span className="header-mode-trigger-value">{t(activeMode.labelKey)}</span>
              <svg className="header-mode-trigger-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="header-right">
          <div className="header-studio-pill" title={studioSummary}>
            <span className="header-studio-label">Studio</span>
            <span className="header-studio-value">{studioSummary}</span>
          </div>
          <a
            className="header-gh-btn"
            href={PROJECT_REPOSITORY_URL}
            target="_blank"
            rel="noopener"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>GitHub</span>
          </a>
          <button className="btn btn-ghost what-is-this-btn" onClick={() => setShowAbout(true)}>
            {t('header.about')}
          </button>
          <button className="btn btn-ghost header-lang-btn" onClick={onToggleLocale} title={t('app.language.switch')}>
            {locale === 'zh-CN' ? t('app.language.en') : t('app.language.zh-CN')}
          </button>
          <div className="header-divider" />

          {/* Active model display */}
          <button className="header-model-btn" onClick={onOpenSettings}>
            <span className={`header-status-dot ${hasKey ? 'on' : ''}`} />
            <span className="header-model-provider">{providerName}</span>
            <span className="header-model-sep">/</span>
            <span className="header-model-name">{modelLabel}</span>
            <svg className="header-gear" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>

      {showModeMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="header-mode-popover"
          ref={modePopoverRef}
          style={modeMenuStyle}
          role="menu"
          aria-label={t('mode.switcher.label')}
        >
          {modes.map((mode) => {
            const active = mode.id === modeId
            return (
              <button
                key={mode.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`header-mode-item ${active ? 'active' : ''}`}
                onClick={() => {
                  onModeChange(mode.id)
                  setShowModeMenu(false)
                }}
              >
                <span className="header-mode-item-copy">
                  <span className="header-mode-item-name">{t(mode.labelKey)}</span>
                  <span className="header-mode-item-summary">{t(mode.summaryKey)}</span>
                </span>
                {active && <span className="header-mode-item-check">ok</span>}
              </button>
            )
          })}
        </div>,
        document.body,
      )}

      {showAbout && (
        <div className="about-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-card" onClick={(e) => e.stopPropagation()}>
            <button className="about-close" onClick={() => setShowAbout(false)}>&times;</button>
            <h2 className="about-title">{t('header.about.title')}</h2>
            <p className="about-subtitle">{t('header.about.subtitle')}</p>

            <div className="about-body">
              <p>{t('header.about.intro')}</p>

              <h3>{t('header.about.providers')}</h3>
              <ul>
                <li>{t('header.about.providers.custom')}</li>
                <li>{t('header.about.providers.chatgpt')}</li>
                <li>{t('header.about.providers.kimi')}</li>
                <li>{t('header.about.providers.zai')}</li>
                <li>{t('header.about.providers.google')}</li>
                <li>{t('header.about.providers.fireworks')}</li>
                <li>{t('header.about.providers.openrouter')}</li>
              </ul>

              <h3>{t('header.about.how')}</h3>
              <ol>
                <li>{t('header.about.step1')}</li>
                <li>{t('header.about.step2')}</li>
                <li>{t('header.about.step3')}</li>
                <li>{t('header.about.step4')}</li>
              </ol>

              <h3>{t('header.about.features')}</h3>
              <ul>
                <li>{t('header.about.feature1')}</li>
                <li>{t('header.about.feature2')}</li>
                <li>{t('header.about.feature3')}</li>
                <li>{t('header.about.feature4')}</li>
              </ul>

              <div className="about-footer">
                <span>{t('header.about.footer.providers')}</span>
                <span>{t('header.about.footer.builtBy')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
