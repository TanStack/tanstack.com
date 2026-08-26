import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createBuilderAiProgressGate,
  fingerprintBuilderAiDiagnostic,
  fingerprintBuilderAiValue,
  parseBuilderAiAttemptTrace,
  parseBuilderAiRepairContext,
  recordBuilderAiFailure,
} from '../src/utils/builder-ai-progress'

test('requires evidence with a new result before a repair mutation', () => {
  const repeatedEvidence = fingerprintBuilderAiValue({
    toolName: 'read_file',
    input: { path: '/index.tsx', offset: 0 },
    output: { content: 'old source' },
  })
  const gate = createBuilderAiProgressGate({
    priorEvidenceFingerprints: [repeatedEvidence],
    blockedMutationFingerprints: [],
  })

  assert.equal(gate.required, true)
  assert.throws(
    () => gate.assertCanMutate('replace_file', { path: '/index.tsx' }),
    /differs from prior repair attempts/,
  )

  gate.recordEvidence(
    'read_file',
    { path: '/index.tsx', offset: 0 },
    { content: 'old source' },
  )
  assert.throws(
    () => gate.assertCanMutate('replace_file', { path: '/index.tsx' }),
    /differs from prior repair attempts/,
  )

  gate.recordEvidence(
    'read_file',
    { path: '/index.tsx', offset: 0 },
    { content: 'current source' },
  )
  assert.doesNotThrow(() =>
    gate.assertCanMutate('replace_file', { path: '/index.tsx' }),
  )
})

test('rejects an exact mutation that already failed', () => {
  const input = { path: '/index.tsx', content: 'broken source' }
  const blockedMutation = fingerprintBuilderAiValue({
    toolName: 'replace_file',
    input,
  })
  const gate = createBuilderAiProgressGate({
    priorEvidenceFingerprints: [],
    blockedMutationFingerprints: [blockedMutation],
  })
  gate.recordEvidence(
    'read_file',
    { path: '/index.tsx', offset: 0 },
    { content: 'current source' },
  )

  assert.throws(
    () => gate.assertCanMutate('replace_file', input),
    /exact mutation already/,
  )

  const changed = gate.assertCanMutate('replace_file', {
    path: '/index.tsx',
    content: 'different source',
  })
  gate.recordMutation(changed)
  assert.deepEqual(gate.trace().mutationFingerprints, [changed])
})

test('ordinary turns record evidence and mutations without gating', () => {
  const gate = createBuilderAiProgressGate(undefined)
  const input = { path: '/index.tsx', content: 'next source' }
  const mutation = gate.assertCanMutate('replace_file', input)
  gate.recordEvidence(
    'read_file',
    { path: '/index.tsx', offset: 0 },
    { content: 'current source' },
  )
  gate.recordMutation(mutation)

  assert.equal(gate.required, false)
  assert.equal(gate.trace().evidenceFingerprints.length, 1)
  assert.deepEqual(gate.trace().mutationFingerprints, [mutation])
  assert.throws(
    () => gate.assertCanMutate('replace_file', input),
    /exact mutation already/,
  )
})

test('strictly parses bounded repair contexts and attempt traces', () => {
  const fingerprint = fingerprintBuilderAiValue('evidence')
  assert.deepEqual(
    parseBuilderAiRepairContext({
      priorEvidenceFingerprints: [fingerprint, fingerprint],
      blockedMutationFingerprints: [],
    }),
    {
      priorEvidenceFingerprints: [fingerprint],
      blockedMutationFingerprints: [],
    },
  )
  assert.deepEqual(
    parseBuilderAiAttemptTrace({
      evidenceFingerprints: [fingerprint],
      mutationFingerprints: [],
    }),
    {
      evidenceFingerprints: [fingerprint],
      mutationFingerprints: [],
    },
  )
  assert.throws(
    () =>
      parseBuilderAiRepairContext({
        priorEvidenceFingerprints: ['not-a-fingerprint'],
        blockedMutationFingerprints: [],
      }),
    /Invalid builder AI repair context/,
  )
})

test('fingerprints are stable across object key order and change with evidence', () => {
  assert.equal(
    fingerprintBuilderAiValue({ path: '/index.tsx', offset: 0 }),
    fingerprintBuilderAiValue({ offset: 0, path: '/index.tsx' }),
  )
  assert.notEqual(
    fingerprintBuilderAiValue({ content: 'first' }),
    fingerprintBuilderAiValue({ content: 'second' }),
  )
  assert.equal(
    fingerprintBuilderAiDiagnostic('runtime', ' Missing\n export '),
    fingerprintBuilderAiDiagnostic('runtime', 'Missing export'),
  )
})

test('tracks new evidence, blocks failed mutations, and detects state cycles', () => {
  const first = recordBuilderAiFailure([], {
    failureFingerprint: '1111111111111111',
    executionFingerprint: '2222222222222222',
    evidenceFingerprints: ['3333333333333333'],
    mutationFingerprints: ['4444444444444444'],
  })

  assert.equal(first.repeatedState, false)
  assert.deepEqual(first.repair, {
    priorEvidenceFingerprints: ['3333333333333333'],
    blockedMutationFingerprints: ['4444444444444444'],
  })

  const changedFailure = recordBuilderAiFailure(first.history, {
    failureFingerprint: '5555555555555555',
    executionFingerprint: '2222222222222222',
    evidenceFingerprints: ['6666666666666666'],
    mutationFingerprints: ['7777777777777777'],
  })
  assert.deepEqual(changedFailure.repair.blockedMutationFingerprints, [
    '7777777777777777',
  ])

  const cycle = recordBuilderAiFailure(changedFailure.history, {
    failureFingerprint: '1111111111111111',
    executionFingerprint: '2222222222222222',
    evidenceFingerprints: [],
    mutationFingerprints: [],
  })
  assert.equal(cycle.repeatedState, true)
  assert.deepEqual(cycle.repair.blockedMutationFingerprints, [
    '4444444444444444',
  ])
})
