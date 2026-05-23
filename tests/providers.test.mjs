import test from 'node:test'
import assert from 'node:assert/strict'

import {
  COMPATIBLE_OPENAI_PROVIDER_ID,
  PROVIDERS,
  getCustomConfigErrorForPurpose,
  loadProviderState,
  makeDefaultProviderState,
} from '../src/lib/providers.ts'

function createStorage() {
  const map = new Map()
  return {
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
}

test('provider cards keep Compatible OpenAI first, followed by ChatGPT and Kimi', () => {
  assert.deepEqual(
    PROVIDERS.slice(0, 3).map((provider) => provider.id),
    ['custom', 'chatgpt', 'kimi'],
  )
})

test('new provider state defaults to Compatible OpenAI', () => {
  const originalLocalStorage = globalThis.localStorage
  const storage = createStorage()
  globalThis.localStorage = storage

  try {
    const state = makeDefaultProviderState()
    assert.equal(state.activeProviderId, COMPATIBLE_OPENAI_PROVIDER_ID)
    assert.equal(state.activeModelId, '')
  } finally {
    globalThis.localStorage = originalLocalStorage
  }
})

test('Compatible OpenAI requires an API key as well as endpoint and model', () => {
  const originalLocalStorage = globalThis.localStorage
  globalThis.localStorage = createStorage()

  try {
    const state = makeDefaultProviderState()
    state.custom.mode = 'compatible'
    state.custom.endpoint = 'https://api.example.com/v1/chat/completions'
    state.custom.modelId = 'demo-model'

    assert.equal(
      getCustomConfigErrorForPurpose(state.custom, '', 'request'),
      'provider.validation.apiKeyRequired',
    )
  } finally {
    globalThis.localStorage = originalLocalStorage
  }
})

test('legacy z.ai default without a saved key falls back to Compatible OpenAI', () => {
  const originalLocalStorage = globalThis.localStorage
  const storage = createStorage()
  storage.setItem('vcanvas_provider_state', JSON.stringify({
    activeProviderId: 'zai',
    activeModelId: 'glm-5v-turbo',
    keys: {
      zai: '',
    },
  }))
  globalThis.localStorage = storage

  try {
    const state = loadProviderState()
    assert.equal(state.activeProviderId, COMPATIBLE_OPENAI_PROVIDER_ID)
    assert.equal(state.activeModelId, '')
  } finally {
    globalThis.localStorage = originalLocalStorage
  }
})
