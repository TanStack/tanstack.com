import assert from 'node:assert/strict'
import test from 'node:test'
import { ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import { OPENAI_CHAT_MODELS } from '@tanstack/ai-openai'
import {
  findNotebookAiRemoteModel,
  notebookAiDefaultRemoteModels,
  notebookAiRemoteModels,
  notebookAiRemoteProviders,
} from '../src/utils/notebook-ai'

test('notebook model catalog only exposes models supported by each adapter', () => {
  for (const model of notebookAiRemoteModels) {
    const providerModels =
      model.provider === 'openai' ? OPENAI_CHAT_MODELS : ANTHROPIC_MODELS

    assert.equal(
      providerModels.some((candidate) => candidate === model.model),
      true,
      `${model.provider} adapter does not support ${model.model}`,
    )
    assert.equal(findNotebookAiRemoteModel(model.provider, model.model), model)
  }
})

test('notebook model defaults belong to their provider catalog', () => {
  for (const provider of notebookAiRemoteProviders) {
    const model = notebookAiDefaultRemoteModels[provider]
    assert.equal(model.provider, provider)
    assert.equal(findNotebookAiRemoteModel(provider, model.model), model)
  }

  assert.equal(notebookAiDefaultRemoteModels.openai.model, 'gpt-5.6-luna')
})

test('notebook model catalog rejects unlisted adapter models', () => {
  assert.equal(findNotebookAiRemoteModel('openai', 'gpt-4o'), undefined)
  assert.equal(
    findNotebookAiRemoteModel('anthropic', 'claude-opus-4-6'),
    undefined,
  )
})
