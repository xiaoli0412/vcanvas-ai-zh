import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CANVAS_MODES,
  applySurprisePrompt,
  getCanvasMode,
  getDefaultModeId,
  getModePromptStudioState,
  loadModeSessionState,
  mergeModeSessionStudioState,
  normalizeModeSessionState,
  VCANVAS_MODE_STATE_STORAGE_KEY,
} from '../src/lib/canvasModes.ts'
import {
  DEFAULT_PROMPT_STUDIO_STATE,
  normalizePromptStudioState,
} from '../src/lib/promptPresets.ts'
import {
  buildGeneratePrompt,
  buildPlanPhaseContext,
  buildRefinePrompt,
  buildSystemPrompt,
} from '../src/lib/promptBuilder.ts'

const sampleMode = getCanvasMode('wild')
const sampleStudio = normalizePromptStudioState(sampleMode.defaultStudioState)

test('classic mode is the default entry for both existing and fresh installs', () => {
  assert.equal(getDefaultModeId(true), 'classic-studio')
  assert.equal(getDefaultModeId(false), 'classic-studio')
})

test('mode sessions preserve the classic studio state and hydrate mode defaults', () => {
  const classicStudio = {
    ...DEFAULT_PROMPT_STUDIO_STATE,
    workflowId: 'commerce-flow',
    styleIds: ['stripe'],
  }

  const session = normalizeModeSessionState({
    activeModeId: 'story',
    studioByMode: {
      'classic-studio': classicStudio,
    },
  }, {
    existingClassicStudio: classicStudio,
    isExistingUser: true,
  })

  assert.equal(session.activeModeId, 'story')
  assert.deepEqual(session.studioByMode['classic-studio'], normalizePromptStudioState(classicStudio))
  assert.deepEqual(session.studioByMode.story, normalizePromptStudioState(CANVAS_MODES.story.defaultStudioState))
})

test('legacy spark default migrates back to classic until the user explicitly chooses a mode', () => {
  const originalLocalStorage = globalThis.localStorage
  const map = new Map()
  globalThis.localStorage = {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }

  try {
    globalThis.localStorage.setItem(VCANVAS_MODE_STATE_STORAGE_KEY, JSON.stringify({
      activeModeId: 'spark',
      studioByMode: {},
      urlByMode: {},
    }))

    const session = loadModeSessionState({
      existingClassicStudio: DEFAULT_PROMPT_STUDIO_STATE,
      isExistingUser: true,
    })

    assert.equal(session.activeModeId, 'classic-studio')
    assert.equal(session.hasExplicitModeChoice, false)
  } finally {
    globalThis.localStorage = originalLocalStorage
  }
})

test('mode studio updates are remembered per mode without mutating other presets', () => {
  const session = normalizeModeSessionState(undefined, {
    existingClassicStudio: DEFAULT_PROMPT_STUDIO_STATE,
    isExistingUser: false,
  })

  const updated = mergeModeSessionStudioState(session, 'spark', {
    ...CANVAS_MODES.spark.defaultStudioState,
    tone: 'bold',
  })

  assert.equal(getModePromptStudioState(updated, 'spark').tone, 'bold')
  assert.equal(getModePromptStudioState(updated, 'map').workflowId, CANVAS_MODES.map.defaultStudioState.workflowId)
})

test('surprise prompt uses a starter when empty and appends a twist when prompt already exists', () => {
  const emptyPrompt = applySurprisePrompt('', CANVAS_MODES.spark)
  const appendedPrompt = applySurprisePrompt('Make a dashboard', CANVAS_MODES.spark)

  assert.match(emptyPrompt, /unexpected/)
  assert.match(emptyPrompt, /bold/)
  assert.match(appendedPrompt, /Make a dashboard/)
  assert.match(appendedPrompt, /Push the concept further/)
})

test('mode-aware prompts inject manifesto, starter, and plan context before studio directives', () => {
  const systemPrompt = buildSystemPrompt('Base system prompt', sampleStudio, sampleMode)
  const generatePrompt = buildGeneratePrompt('Turn this into something memorable', sampleStudio, sampleMode)
  const refinePrompt = buildRefinePrompt('', sampleStudio, 'Polish the layout', sampleMode)
  const planContext = buildPlanPhaseContext(sampleStudio, sampleMode)

  assert.match(systemPrompt, /## Mode Manifesto/)
  assert.match(systemPrompt, /Creative Direction:/)
  assert.ok(systemPrompt.indexOf('## Mode Manifesto') < systemPrompt.indexOf('## Studio Directives'))

  assert.match(generatePrompt, /Mode starter:/)
  assert.match(generatePrompt, /mutation/)
  assert.match(refinePrompt, /Refinement request:/)
  assert.match(refinePrompt, /Polish the layout/)

  assert.match(planContext, /Mode goal:/)
  assert.match(planContext, /Mode guardrails:/)
})
