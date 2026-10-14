import type { UIMessage } from '@tanstack/ai'
import { describe, expect, it } from 'vitest'
import {
  canonicalCopyJson,
  copyReceipt,
  projectBranchContext,
} from '../../src/chat/core/conversation-copy'
import {
  maxRetrySourceBytes,
  projectRetryTurn,
} from '../../src/chat/core/retry-source'
import type { ArchivedTurn } from '../../src/chat/core/transcript'
import type { Approval } from '../../src/chat/core/types'

const prompt: UIMessage = {
  id: 'request',
  role: 'user',
  parts: [{ type: 'text', content: '  Update the document.\n' }],
}
const response: UIMessage = {
  id: 'response',
  role: 'assistant',
  parts: [{ type: 'text', content: 'Updated.' }],
}
const turn = (changes: Partial<ArchivedTurn> = {}): ArchivedTurn => ({
  id: prompt.id,
  messages: [structuredClone(prompt), structuredClone(response)],
  approvals: [],
  outcome: { status: 'done', answerId: response.id },
  ...changes,
})
const approval = (changes: Partial<Approval> = {}): Approval => ({
  id: 'approval',
  messageId: prompt.id,
  assistantTaskId: 'old-task',
  resumeRequest: 'Resume this old task',
  title: 'Update document',
  code: 'saved code',
  status: 'done',
  executionOutcome: 'succeeded',
  result: 'Document saved',
  ...changes,
})

describe('retry source evidence', () => {
  it('preserves immediate tools and completed and unknown actions as detached historical evidence', () => {
    const completed = approval()
    const unknown = approval({
      id: 'unconfirmed',
      status: 'error',
      executionOutcome: 'unknown',
      result: 'The action ended without a confirmed result.',
    })
    const original = turn({
      messages: [
        structuredClone(prompt),
        {
          ...structuredClone(response),
          parts: [
            { type: 'thinking', content: 'Private reasoning' },
            {
              type: 'tool-call',
              id: 'read-call',
              name: 'read_connected_tool',
              arguments: '{"entryId":"document"}',
              state: 'complete',
              output: { result: { text: 'Original document' } },
            },
            {
              type: 'tool-result',
              id: 'read-result',
              name: 'read_connected_tool',
              toolCallId: 'read-call',
              content: '{"result":"Original document"}',
              state: 'complete',
            },
            { type: 'text', content: 'Updated.' },
          ],
        },
      ],
      approvals: [completed, unknown],
    })
    const before = structuredClone(original)
    const result = projectRetryTurn(original)
    expect(result.request.text).toBe('  Update the document.\n')
    expect(result.evidence).toMatchObject({
      kind: 'turn',
      id: prompt.id,
      partial: false,
      outcome: { status: 'done', answerId: response.id },
      receipts: [copyReceipt(completed), copyReceipt(unknown)],
    })
    expect(result.evidence.messages[1].parts.map((part) => part.type)).toEqual([
      'tool-call',
      'tool-result',
      'text',
    ])
    expect(
      result.evidence.messages.every(
        (message) => message.metadata?.gumInherited,
      ),
    ).toBe(true)
    const json = canonicalCopyJson(result)
    expect(json).not.toContain('Private reasoning')
    expect(json).not.toContain('assistantTaskId')
    expect(json).not.toContain('resumeRequest')
    expect(json).not.toContain('"approvals"')
    expect(original).toEqual(before)
    const call = result.evidence.messages[1].parts[0]
    if (call.type !== 'tool-call') throw new Error('Expected tool evidence')
    ;(call.output as { result: { text: string } }).result.text =
      'Changed projection'
    result.evidence.receipts[0].result = 'Changed receipt'
    expect(original).toEqual(before)
    expect(
      projectBranchContext(result.evidence.messages).flatMap((message) =>
        message.parts.filter(
          (part) => part.type === 'tool-call' || part.type === 'tool-result',
        ),
      ),
    ).toEqual([])
  })

  it('deduplicates equal inherited and live receipts without transferring authority', () => {
    const live = approval()
    const result = projectRetryTurn(
      turn({
        receipts: [
          { ...copyReceipt(live), resumeRequest: 'Forged resume' } as Approval,
        ],
        approvals: [live],
        inherited: { partial: true },
      }),
    )
    expect(result.evidence.receipts).toEqual([copyReceipt(live)])
    expect(result.evidence.partial).toBe(true)
    expect(canonicalCopyJson(result)).not.toContain('Forged resume')
  })

  it('removes thinking inside typed tool-result content while retaining its visible evidence', () => {
    const original = turn({
      messages: [
        prompt,
        {
          ...response,
          parts: [
            {
              type: 'tool-result',
              id: 'nested-result',
              name: 'read_document',
              toolCallId: 'nested-call',
              state: 'complete',
              content: [
                // @ts-expect-error Saved malformed tool content must not expose reasoning.
                { type: 'thinking', content: 'Private nested reasoning' },
                { type: 'text', content: 'Visible tool evidence' },
              ],
            },
          ],
        },
      ],
    })
    const result = projectRetryTurn(original)
    expect(result.evidence.messages[1].parts[0]).toMatchObject({
      content: [{ type: 'text', content: 'Visible tool evidence' }],
    })
    expect(canonicalCopyJson(result)).not.toContain('Private nested reasoning')
    expect(original.messages[1].parts[0]).toMatchObject({
      content: [
        { type: 'thinking', content: 'Private nested reasoning' },
        { type: 'text', content: 'Visible tool evidence' },
      ],
    })
  })

  it('rejects conflicting receipt outcomes instead of choosing one', () => {
    const live = approval()
    expect(() =>
      projectRetryTurn(
        turn({
          receipts: [copyReceipt({ ...live, executionOutcome: 'unknown' })],
          approvals: [live],
        }),
      ),
    ).toThrow('conflicting results')
  })

  it.each(['pending', 'running'] as const)(
    'rejects a %s live approval',
    (status) => {
      expect(() =>
        projectRetryTurn(turn({ approvals: [approval({ status })] })),
      ).toThrow('pending action')
    },
  )

  it('retains pending inherited receipts as historical evidence without reviving work', () => {
    const receipt = copyReceipt(
      approval({
        status: 'pending',
        executionOutcome: undefined,
        result: undefined,
      }),
    )
    const result = projectRetryTurn(
      turn({
        receipts: [receipt],
        inherited: { partial: true },
        outcome: undefined,
      }),
    )
    expect(result.evidence.receipts).toEqual([receipt])
    expect(result.evidence.partial).toBe(true)
    expect(result.evidence.outcome).toBeUndefined()
  })

  it('preserves an error outcome and incomplete tool state without claiming no effect occurred', () => {
    const result = projectRetryTurn(
      turn({
        outcome: { status: 'error' },
        messages: [
          prompt,
          {
            ...response,
            parts: [
              {
                type: 'tool-call',
                id: 'unfinished',
                name: 'save_document',
                arguments: '{}',
                state: 'input-complete',
              },
            ],
          },
        ],
      }),
    )
    expect(result.evidence.outcome).toEqual({ status: 'error' })
    expect(result.evidence.partial).toBe(false)
    expect(result.evidence.messages[1].parts[0]).toMatchObject({
      state: 'error',
      metadata: { gumHistoricalState: 'input-complete' },
    })
    expect(result.evidence.receipts).toEqual([])
  })

  it.each([
    ['empty', turn({ messages: [] })],
    ['assistant first', turn({ messages: [response] })],
    [
      'another prompt',
      turn({ messages: [prompt, response, { ...prompt, id: 'other' }] }),
    ],
    ['mismatched turn', turn({ id: 'other' })],
    [
      'duplicate message identity',
      turn({ messages: [prompt, { ...response, id: prompt.id }] }),
    ],
    [
      'missing message identity',
      turn({ messages: [prompt, { ...response, id: '' }] }),
    ],
  ])('rejects ambiguous selection: %s', (_label, source) => {
    expect(() => projectRetryTurn(source as ArchivedTurn)).toThrow(
      'one complete user request',
    )
  })

  it('rejects a waiting turn and a final answer outside the selected turn', () => {
    expect(() =>
      projectRetryTurn(turn({ outcome: { status: 'waiting' } })),
    ).toThrow('pending action')
    expect(() =>
      projectRetryTurn(
        turn({ outcome: { status: 'done', answerId: 'another' } }),
      ),
    ).toThrow('outcome could not be verified')
  })

  it('retains stored-result references without claiming their payload was transferred', () => {
    const result = projectRetryTurn(
      turn({
        messages: [
          prompt,
          {
            ...response,
            parts: [
              {
                type: 'tool-call',
                id: 'large-result',
                name: 'read_document',
                arguments: '{}',
                state: 'complete',
                output: {
                  kind: 'stored-tool-result',
                  resultId: 'source-result',
                  preview: 'Preview only',
                },
              },
            ],
          },
        ],
      }),
    )
    expect(result.evidence.messages[1].parts[0]).toMatchObject({
      output: {
        kind: 'stored-tool-result',
        resultId: 'source-result',
        preview: 'Preview only',
      },
    })
  })

  it('bounds the serialized UTF8 payload without truncating multibyte evidence', () => {
    const original = turn({
      messages: [
        prompt,
        {
          ...response,
          parts: [
            { type: 'text', content: '😀'.repeat(maxRetrySourceBytes / 4) },
          ],
        },
      ],
    })
    const before = structuredClone(original)
    expect(() => projectRetryTurn(original)).toThrow('too large to restore')
    expect(original).toEqual(before)
    const smaller = turn({
      messages: [
        prompt,
        { ...response, parts: [{ type: 'text', content: '😀'.repeat(1000) }] },
      ],
    })
    expect(projectRetryTurn(smaller).evidence.messages[1].parts[0]).toEqual(
      smaller.messages[1].parts[0],
    )
  })
})
