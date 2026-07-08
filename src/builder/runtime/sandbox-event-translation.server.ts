import type { StreamChunk } from '@tanstack/ai'

/**
 * Injected callbacks the pure `translateChunk` translation layer delegates
 * to. Keeping these as callbacks (rather than having `translateChunk` do its
 * own I/O) is what makes the translation unit-testable without a live forge
 * run: a test can pass a spy `ctx` and assert on recorded calls.
 *
 * Mirrors the chunk-handling shape of `appendTanStackAiStreamChunk` in
 * `local-agent.server.ts`, but expressed as a plain callback surface instead
 * of forge-append helpers bound to `ForgeRunContext`/`ForgeAgentState`.
 */
export type ForgeChunkTranslationCtx = {
  /** TEXT_MESSAGE_START/CONTENT/END -> assistant chat text. */
  onText: (event: {
    kind: 'start' | 'content' | 'end'
    messageId: string
    delta?: string
  }) => void

  /** TOOL_CALL_START/ARGS/END -> assistant tool-call activity. */
  onToolCall: (event: {
    kind: 'start' | 'args' | 'end' | 'result'
    toolCallId: string
    toolCallName?: string
    delta?: string
    result?: string
  }) => void

  /** REASONING_MESSAGE_* chunks -> assistant reasoning activity. */
  onReasoning: (event: {
    kind: 'start' | 'content' | 'end'
    messageId: string
    delta?: string
  }) => void

  /**
   * `CUSTOM` chunk named `codex.session-id` (Codex) or `claude-code.session-id`
   * (Claude Code) -> best-effort session-id persistence so a dropped
   * connection can resume against the same agent session.
   */
  persistSessionId: (sessionId: string) => void

  /**
   * `CUSTOM` chunk named `sandbox.file` -> a file was created/changed/deleted
   * inside the sandbox during the run.
   */
  onFileActivity: (event: {
    type: 'create' | 'change' | 'delete'
    path: string
    timestamp: number
  }) => void

  /**
   * `CUSTOM` chunk named `file.changed` -> rebuild/finalize the R2 manifest.
   * `translateChunk` only routes to this callback; the callback itself owns
   * the actual manifest persistence.
   */
  finalizeManifest: (event: { path: string; diff: string }) => void

  /**
   * Any other `CUSTOM` chunk -> observability event. These used to be silently
   * ignored, which made sandbox-side activity impossible to inspect from Forge.
   */
  onCustomEvent: (event: {
    name: string
    timestamp?: number
    value: unknown
  }) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readSessionIdValue(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  if (!('sessionId' in value)) {
    return undefined
  }

  const { sessionId } = value
  return typeof sessionId === 'string' && sessionId.length > 0
    ? sessionId
    : undefined
}

function readSandboxFileValue(
  value: unknown,
):
  | { type: 'create' | 'change' | 'delete'; path: string; timestamp: number }
  | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  if (!('type' in value) || !('path' in value) || !('timestamp' in value)) {
    return undefined
  }

  const { type, path, timestamp } = value

  if (
    (type !== 'create' && type !== 'change' && type !== 'delete') ||
    typeof path !== 'string' ||
    path.length === 0 ||
    typeof timestamp !== 'number'
  ) {
    return undefined
  }

  return { path, timestamp, type }
}

function readFileChangedValue(
  value: unknown,
): { path: string; diff: string } | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  if (!('path' in value) || !('diff' in value)) {
    return undefined
  }

  const { path, diff } = value

  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    typeof diff !== 'string'
  ) {
    return undefined
  }

  return { diff, path }
}

/**
 * Pure translation of a single TanStack AI `StreamChunk` into forge state
 * events. Performs no I/O itself -- every side effect is routed through the
 * injected `ctx` callbacks, which keeps this function trivially testable and
 * safe to run under plain `tsx` (no sandbox/Cloudflare runtime imports).
 */
export function translateChunk(
  chunk: StreamChunk,
  ctx: ForgeChunkTranslationCtx,
): void {
  switch (chunk.type) {
    case 'TEXT_MESSAGE_START': {
      if (chunk.role && chunk.role !== 'assistant') {
        return
      }
      ctx.onText({ kind: 'start', messageId: chunk.messageId })
      return
    }

    case 'TEXT_MESSAGE_CONTENT': {
      ctx.onText({
        delta: chunk.delta,
        kind: 'content',
        messageId: chunk.messageId,
      })
      return
    }

    case 'TEXT_MESSAGE_END': {
      ctx.onText({ kind: 'end', messageId: chunk.messageId })
      return
    }

    case 'TOOL_CALL_START': {
      ctx.onToolCall({
        kind: 'start',
        toolCallId: chunk.toolCallId,
        toolCallName: chunk.toolCallName,
      })
      return
    }

    case 'TOOL_CALL_ARGS': {
      ctx.onToolCall({
        delta: chunk.delta,
        kind: 'args',
        toolCallId: chunk.toolCallId,
      })
      return
    }

    case 'TOOL_CALL_END': {
      ctx.onToolCall({
        kind: 'end',
        result: typeof chunk.result === 'string' ? chunk.result : undefined,
        toolCallId: chunk.toolCallId,
        toolCallName: chunk.toolCallName ?? chunk.toolName,
      })
      return
    }

    case 'TOOL_CALL_RESULT': {
      ctx.onToolCall({
        kind: 'result',
        result: chunk.content,
        toolCallId: chunk.toolCallId,
      })
      return
    }

    case 'REASONING_MESSAGE_START': {
      ctx.onReasoning({ kind: 'start', messageId: chunk.messageId })
      return
    }

    case 'REASONING_MESSAGE_CONTENT': {
      ctx.onReasoning({
        delta: chunk.delta,
        kind: 'content',
        messageId: chunk.messageId,
      })
      return
    }

    case 'REASONING_MESSAGE_END': {
      ctx.onReasoning({ kind: 'end', messageId: chunk.messageId })
      return
    }

    case 'CUSTOM': {
      if (
        chunk.name === 'codex.session-id' ||
        chunk.name === 'claude-code.session-id'
      ) {
        const sessionId = readSessionIdValue(chunk.value)
        if (sessionId) {
          ctx.persistSessionId(sessionId)
        }
        return
      }

      // NOTE: both harness adapters (`codexText`, `claudeCodeText`) emit their
      // `*.session-id` as a CUSTOM chunk but do NOT emit `sandbox.file`. For the
      // forge sandbox path, live file activity comes from
      // `forgePersistenceHooks.onFile` (mirroring sandbox writes to R2 + the
      // activity feed) and the authoritative final manifest comes from
      // `collectWorkspaceFiles` feeding the shared `drainLocalForgeAgentRun`
      // finalize. The `sandbox.file` branch is therefore dead today; it is kept
      // as forward-compat for adapters that DO surface file events as CUSTOM
      // chunks. Claude Code's `file.changed` (git diff) is handled below.
      if (chunk.name === 'sandbox.file') {
        const fileEvent = readSandboxFileValue(chunk.value)
        if (fileEvent) {
          ctx.onFileActivity(fileEvent)
        }
        return
      }

      if (chunk.name === 'file.changed') {
        const changed = readFileChangedValue(chunk.value)
        if (changed) {
          ctx.finalizeManifest(changed)
        }
        return
      }

      ctx.onCustomEvent({
        name: chunk.name,
        timestamp: chunk.timestamp,
        value: chunk.value,
      })
      return
    }

    default:
      return
  }
}
