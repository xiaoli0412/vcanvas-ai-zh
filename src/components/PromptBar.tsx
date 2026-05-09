import React, { useState, useRef, useCallback } from 'react'
import type { Translate } from '../lib/i18n'
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
  hasOutput: boolean
  generating: boolean
  planMode: boolean
  onPlanModeToggle: () => void
  hasKey: boolean
  t: Translate
}

export function PromptBar({ onGenerate, onRefine, onClear, hasOutput, generating, planMode, onPlanModeToggle, hasKey, t }: Props) {
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const text = prompt.trim()
    if (generating) return
    if (hasOutput) {
      onRefine(text)
    } else {
      if (!text) return
      onGenerate(text)
    }
    setPrompt('')
  }, [prompt, generating, hasOutput, onGenerate, onRefine])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleInspiration = useCallback((text: string) => {
    setPrompt(text)
    textareaRef.current?.focus()
  }, [])

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

      <textarea
        ref={textareaRef}
        className="prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
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
