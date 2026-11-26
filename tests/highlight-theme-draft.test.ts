import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultDraft,
  restoreDraft,
} from '../src/components/highlight-theme-editor/draft'
import { themePresets } from '../src/components/highlight-theme-editor/tokenGroups'

test('theme editor restores every shipped preset', () => {
  for (const preset of themePresets) {
    const draft = { ...defaultDraft, presetId: preset.id, theme: preset.theme }
    assert.deepEqual(restoreDraft(draft), draft)
  }
})

test('theme editor preserves a valid customized draft', () => {
  const draft = {
    ...defaultDraft,
    lang: 'js',
    theme: { ...defaultDraft.theme, name: '2026 Night', background: '#123' },
  }
  assert.deepEqual(restoreDraft(draft), draft)
})

test('theme editor replaces malformed, stale and partial drafts', () => {
  for (const value of [
    null,
    [],
    {},
    { ...defaultDraft, lang: 'unsupported' },
    { ...defaultDraft, presetId: 'removed-preset' },
    { ...defaultDraft, theme: null },
    { ...defaultDraft, theme: { ...defaultDraft.theme, type: 'invalid' } },
    { ...defaultDraft, theme: { ...defaultDraft.theme, tokens: {} } },
    {
      ...defaultDraft,
      theme: { ...defaultDraft.theme, background: 'invalid' },
    },
  ]) {
    assert.equal(restoreDraft(value), defaultDraft)
  }
})
