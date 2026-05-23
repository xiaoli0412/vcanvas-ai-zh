import test from 'node:test'
import assert from 'node:assert/strict'

import { createModeChip, formatOutcomeText, trimChipText } from '../src/lib/store.ts'

test('createModeChip applies the current mode badge unless one is explicitly provided', () => {
  const defaultChip = createModeChip('user', 'Generate a concept', 'Spark')
  const customChip = createModeChip('assistant', 'Done', 'Wild', { badge: 'Plan' })

  assert.equal(defaultChip.badge, 'Spark')
  assert.equal(customChip.badge, 'Plan')
})

test('trimChipText keeps short text intact and truncates long text with an ellipsis', () => {
  assert.equal(trimChipText('Short line'), 'Short line')
  assert.equal(trimChipText('A'.repeat(45)), `${'A'.repeat(40)}…`)
})

test('formatOutcomeText creates a compact success string from the current action label', () => {
  assert.equal(formatOutcomeText('Ignite'), 'OK · Ignite')
  assert.equal(formatOutcomeText('Refine'), 'OK · Refine')
})
