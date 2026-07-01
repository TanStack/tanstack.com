import assert from 'node:assert/strict'
import type { StreamChunk } from '@tanstack/ai'
import {
  translateChunk,
  type ForgeChunkTranslationCtx,
} from '../src/builder/runtime/sandbox-event-translation.server'

type Call = { fn: keyof ForgeChunkTranslationCtx; args: unknown }

function createSpyCtx() {
  const calls: Array<Call> = []
  const ctx: ForgeChunkTranslationCtx = {
    finalizeManifest: (event) => {
      calls.push({ args: event, fn: 'finalizeManifest' })
    },
    onFileActivity: (event) => {
      calls.push({ args: event, fn: 'onFileActivity' })
    },
    onReasoning: (event) => {
      calls.push({ args: event, fn: 'onReasoning' })
    },
    onText: (event) => {
      calls.push({ args: event, fn: 'onText' })
    },
    onToolCall: (event) => {
      calls.push({ args: event, fn: 'onToolCall' })
    },
    persistSessionId: (sessionId) => {
      calls.push({ args: sessionId, fn: 'persistSessionId' })
    },
  }
  return { calls, ctx }
}

// 1. text chunks -> ctx.onText (become chat events)
{
  const { calls, ctx } = createSpyCtx()
  const startChunk = {
    messageId: 'm1',
    role: 'assistant',
    type: 'TEXT_MESSAGE_START',
  } as StreamChunk
  const contentChunk = {
    delta: 'hello',
    messageId: 'm1',
    type: 'TEXT_MESSAGE_CONTENT',
  } as StreamChunk
  const endChunk = { messageId: 'm1', type: 'TEXT_MESSAGE_END' } as StreamChunk

  translateChunk(startChunk, ctx)
  translateChunk(contentChunk, ctx)
  translateChunk(endChunk, ctx)

  assert.equal(calls.length, 3)
  assert.deepEqual(
    calls.map((call) => call.fn),
    ['onText', 'onText', 'onText'],
  )
  assert.deepEqual(calls[1].args, {
    delta: 'hello',
    kind: 'content',
    messageId: 'm1',
  })
  console.log('text chunks -> ctx.onText: pass')
}

// 2. tool-call chunks -> ctx.onToolCall
{
  const { calls, ctx } = createSpyCtx()
  translateChunk(
    {
      toolCallId: 't1',
      toolCallName: 'search',
      type: 'TOOL_CALL_START',
    } as StreamChunk,
    ctx,
  )
  translateChunk(
    { delta: '{"q":', toolCallId: 't1', type: 'TOOL_CALL_ARGS' } as StreamChunk,
    ctx,
  )
  translateChunk(
    { toolCallId: 't1', toolCallName: 'search', type: 'TOOL_CALL_END' } as StreamChunk,
    ctx,
  )

  assert.equal(calls.length, 3)
  assert.deepEqual(
    calls.map((call) => call.fn),
    ['onToolCall', 'onToolCall', 'onToolCall'],
  )
  console.log('tool-call chunks -> ctx.onToolCall: pass')
}

// 3. reasoning chunks -> ctx.onReasoning
{
  const { calls, ctx } = createSpyCtx()
  translateChunk(
    {
      messageId: 'r1',
      role: 'reasoning',
      type: 'REASONING_MESSAGE_START',
    } as StreamChunk,
    ctx,
  )
  translateChunk(
    {
      delta: 'thinking...',
      messageId: 'r1',
      type: 'REASONING_MESSAGE_CONTENT',
    } as StreamChunk,
    ctx,
  )
  translateChunk(
    { messageId: 'r1', type: 'REASONING_MESSAGE_END' } as StreamChunk,
    ctx,
  )

  assert.equal(calls.length, 3)
  assert.deepEqual(
    calls.map((call) => call.fn),
    ['onReasoning', 'onReasoning', 'onReasoning'],
  )
  console.log('reasoning chunks -> ctx.onReasoning: pass')
}

// 4. codex.session-id CUSTOM chunk -> ctx.persistSessionId
{
  const { calls, ctx } = createSpyCtx()
  const chunk = {
    name: 'codex.session-id',
    type: 'CUSTOM',
    value: { sessionId: 'sess-123' },
  } as StreamChunk

  translateChunk(chunk, ctx)

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.fn, 'persistSessionId')
  assert.equal(calls[0]?.args, 'sess-123')
  console.log('codex.session-id CUSTOM -> ctx.persistSessionId: pass')
}

// 5. sandbox.file CUSTOM chunk -> ctx.onFileActivity
{
  const { calls, ctx } = createSpyCtx()
  const chunk = {
    name: 'sandbox.file',
    type: 'CUSTOM',
    value: { path: '/workspace/src/app.ts', timestamp: 1_700_000_000, type: 'change' },
  } as StreamChunk

  translateChunk(chunk, ctx)

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.fn, 'onFileActivity')
  assert.deepEqual(calls[0]?.args, {
    path: '/workspace/src/app.ts',
    timestamp: 1_700_000_000,
    type: 'change',
  })
  console.log('sandbox.file CUSTOM -> ctx.onFileActivity: pass')
}

// 6. file.changed CUSTOM chunk -> ctx.finalizeManifest with the diff
{
  const { calls, ctx } = createSpyCtx()
  const chunk = {
    name: 'file.changed',
    type: 'CUSTOM',
    value: {
      diff: '--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-old\n+new\n',
      path: 'src/foo.ts',
    },
  } as StreamChunk

  translateChunk(chunk, ctx)

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.fn, 'finalizeManifest')
  assert.deepEqual(calls[0]?.args, {
    diff: '--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-old\n+new\n',
    path: 'src/foo.ts',
  })
  console.log('file.changed CUSTOM -> ctx.finalizeManifest(diff): pass')
}

// 7. malformed CUSTOM values are safely ignored (no throw, no callback)
{
  const { calls, ctx } = createSpyCtx()

  const malformedSessionId = {
    name: 'codex.session-id',
    type: 'CUSTOM',
    value: { notSessionId: 'sess-123' },
  } as StreamChunk
  const malformedSandboxFile = {
    name: 'sandbox.file',
    type: 'CUSTOM',
    value: { path: '/workspace/src/app.ts' }, // missing type + timestamp
  } as StreamChunk
  const malformedFileChanged = {
    name: 'file.changed',
    type: 'CUSTOM',
    value: 'not-an-object',
  } as StreamChunk
  const malformedFileChangedWrongTypes = {
    name: 'file.changed',
    type: 'CUSTOM',
    value: { diff: 42, path: 'src/foo.ts' },
  } as StreamChunk
  const unrelatedCustom = {
    name: 'some.other.event',
    type: 'CUSTOM',
    value: { anything: true },
  } as StreamChunk

  assert.doesNotThrow(() => translateChunk(malformedSessionId, ctx))
  assert.doesNotThrow(() => translateChunk(malformedSandboxFile, ctx))
  assert.doesNotThrow(() => translateChunk(malformedFileChanged, ctx))
  assert.doesNotThrow(() => translateChunk(malformedFileChangedWrongTypes, ctx))
  assert.doesNotThrow(() => translateChunk(unrelatedCustom, ctx))

  assert.equal(calls.length, 0)
  console.log('malformed/unrelated CUSTOM values are safely ignored: pass')
}

// 8. RUN_ERROR / unrelated chunk types are ignored without throwing
{
  const { calls, ctx } = createSpyCtx()
  assert.doesNotThrow(() =>
    translateChunk(
      { message: 'boom', type: 'RUN_ERROR' } as StreamChunk,
      ctx,
    ),
  )
  assert.equal(calls.length, 0)
  console.log('unhandled chunk types are ignored without throwing: pass')
}

console.log('Forge sandbox event translation verifier passed')
