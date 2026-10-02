import { expect, it } from 'vitest'
import {
  recordToolEvidence,
  toolEvidenceSchema,
} from '../../src/chat/core/tool-evidence'

it('distinguishes returned data, reported errors, approvals and unknown outcomes without copying payloads', () => {
  const evidence = toolEvidenceSchema.parse({
    observedCalls: 0,
    reportedErrors: 0,
    calls: [],
  })
  for (const [ok, result] of [
    [true, { text: 'private source' }],
    [false, undefined],
    [true, { error: 'private failure' }],
    [true, { isError: true }],
    [true, { status: 'invalid_arguments' }],
    [true, { status: 'awaiting_user_approval' }],
    [true, { status: 'unknown' }],
    [true, { error: null }],
  ] as const)
    recordToolEvidence(evidence, 'generic_tool', ok, result)
  expect(evidence.calls.map((call) => call.outcome)).toEqual([
    'returned',
    'reported_error',
    'reported_error',
    'reported_error',
    'reported_error',
    'awaiting_action',
    'unknown',
    'returned',
  ])
  expect(evidence.reportedErrors).toBe(4)
  expect(JSON.stringify(evidence)).not.toContain('private')
})

it('retains total counts when bounded call history rolls over', () => {
  const evidence = { observedCalls: 0, reportedErrors: 0, calls: [] }
  for (let i = 0; i < 120; i++)
    recordToolEvidence(evidence, `tool_${i}`, false, null)
  expect(toolEvidenceSchema.parse(evidence)).toMatchObject({
    observedCalls: 120,
    reportedErrors: 120,
  })
  expect(evidence.calls).toHaveLength(96)
  expect(evidence.calls[0]).toEqual({
    name: 'tool_24',
    outcome: 'reported_error',
  })
})
