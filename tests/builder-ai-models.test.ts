import assert from 'node:assert/strict'
import test from 'node:test'
import { ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import { OPENAI_CHAT_MODELS } from '@tanstack/ai-openai'
import {
  findBuilderAiRemoteModel,
  builderAiDefaultRemoteModels,
  builderAiRemoteModels,
  builderAiRemoteProviders,
} from '../src/utils/builder-ai'

test('builder model catalog only exposes models supported by each adapter', () => {
  for (const model of builderAiRemoteModels) {
    const providerModels =
      model.provider === 'openai' ? OPENAI_CHAT_MODELS : ANTHROPIC_MODELS

    assert.equal(
      providerModels.some((candidate) => candidate === model.model),
      true,
      `${model.provider} adapter does not support ${model.model}`,
    )
    assert.equal(findBuilderAiRemoteModel(model.provider, model.model), model)
  }
})

test('builder model defaults belong to their provider catalog', () => {
  for (const provider of builderAiRemoteProviders) {
    const model = builderAiDefaultRemoteModels[provider]
    assert.equal(model.provider, provider)
    assert.equal(findBuilderAiRemoteModel(provider, model.model), model)
  }

  assert.equal(builderAiDefaultRemoteModels.openai.model, 'gpt-5.6-luna')
})

test('builder model catalog rejects unlisted adapter models', () => {
  assert.equal(findBuilderAiRemoteModel('openai', 'gpt-4o'), undefined)
  assert.equal(
    findBuilderAiRemoteModel('anthropic', 'claude-opus-4-6'),
    undefined,
  )
})
