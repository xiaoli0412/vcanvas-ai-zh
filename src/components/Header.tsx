import React, { useState } from 'react'
import type { Locale, Translate } from '../lib/i18n'
import './Header.css'

interface Props {
  providerName: string
  modelLabel: string
  hasKey: boolean
  onOpenSettings: () => void
  locale: Locale
  onToggleLocale: () => void
  t: Translate
}

export function Header({ providerName, modelLabel, hasKey, onOpenSettings, locale, onToggleLocale, t }: Props) {
  const [showAbout, setShowAbout] = useState(false)

  return (
    <>
      <header className="app-header">
        <div className="header-title">
          <span className="header-title-main">V C A N V A S</span>
          <span className="header-sep">/</span>
          <span className="header-title-sub">PLAYGROUND</span>
          <span className="header-by">by <a href="https://e01.ai" target="_blank" rel="noopener" className="header-by-link">E01.ai</a></span>
        </div>
        <div className="header-right">
          <a
            className="header-gh-btn"
            href="https://github.com/xiaoli0412/vcanvas-ai-zh"
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

      {showAbout && (
        <div className="about-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-card" onClick={(e) => e.stopPropagation()}>
            <button className="about-close" onClick={() => setShowAbout(false)}>&times;</button>
            <h2 className="about-title">{t('header.about.title')}</h2>
            <p className="about-subtitle"><a href="https://e01.ai" target="_blank" rel="noopener">{t('header.about.subtitle')}</a></p>

            <div className="about-body">
              <p>{t('header.about.intro')}</p>

              <h3>{t('header.about.providers')}</h3>
              <ul>
                <li>{t('header.about.providers.zai')}</li>
                <li>{t('header.about.providers.google')}</li>
                <li>{t('header.about.providers.fireworks')}</li>
                <li>{t('header.about.providers.openrouter')}</li>
                <li>{t('header.about.providers.custom')}</li>
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
