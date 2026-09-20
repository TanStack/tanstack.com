import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseBuilderChatGptConnection,
  parseBuilderChatGptLogin,
} from '../src/utils/builder-ai-chatgpt'

test('parses a ChatGPT connection and model catalog', () => {
  assert.deepEqual(
    parseBuilderChatGptConnection({
      connected: true,
      email: 'user@example.com',
      planType: 'plus',
      models: [{ id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', isDefault: true }],
    }),
    {
      connected: true,
      email: 'user@example.com',
      planType: 'plus',
      models: [{ id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', isDefault: true }],
    },
  )
})

test('parses only the official OpenAI device login URL', () => {
  assert.deepEqual(
    parseBuilderChatGptLogin({
      loginId: 'login-1',
      verificationUrl: 'https://auth.openai.com/codex/device',
      userCode: 'ABCD-EFGH',
    }),
    {
      loginId: 'login-1',
      verificationUrl: 'https://auth.openai.com/codex/device',
      userCode: 'ABCD-EFGH',
    },
  )

  assert.throws(
    () =>
      parseBuilderChatGptLogin({
        loginId: 'login-1',
        verificationUrl: 'https://example.com/device',
        userCode: 'ABCD-EFGH',
      }),
    /invalid login response/,
  )
})

test('rejects malformed ChatGPT connection responses', () => {
  assert.throws(
    () =>
      parseBuilderChatGptConnection({
        connected: true,
        models: [{ id: '', label: 'Missing id', isDefault: false }],
      }),
    /invalid connection response/,
  )
})
