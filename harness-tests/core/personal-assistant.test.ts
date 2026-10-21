import { describe, expect, it } from 'vitest'
import { isPersonalAssistant } from '../../src/chat/core/bot-workspace'

describe('personal assistant identity', () => {
  it('recognizes the identity created by the shared account workspace', () => {
    expect(
      isPersonalAssistant({
        id: 'assistant:account',
        workspace_id: 'personal:account',
      }),
    ).toBe(true)
  })
  it('does not classify a foreign account or organization conversation as personal', () => {
    expect(
      isPersonalAssistant({
        id: 'assistant:other',
        workspace_id: 'personal:account',
      }),
    ).toBe(false)
    expect(
      isPersonalAssistant({
        id: 'assistant:account',
        workspace_id: 'company:account',
      }),
    ).toBe(false)
    expect(
      isPersonalAssistant({
        id: 'conversation',
        workspace_id: 'personal:account',
      }),
    ).toBe(false)
    expect(
      isPersonalAssistant({
        id: 'kody:account',
        workspace_id: 'personal:account',
      }),
    ).toBe(false)
  })
})
