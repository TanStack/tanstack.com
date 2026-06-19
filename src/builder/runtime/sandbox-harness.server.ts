// Sandbox-backed Forge harness running a #774 CLI adapter (codex / claude-code)
// inside a @tanstack/ai-sandbox-local-process sandbox.
//
// COMPLETION-FLAG CONTRACT (confirmed against local-agent.server.ts):
//   - `getLocalForgeAgentCompletionProblems` (~2427) requires, for a passing run:
//       state.planReceived === true        (else "agent did not call planRun")
//       state.changeCount > 0              (else "agent did not change any files")
//       state.validated === true           (else "agent did not call validateFiles")
//       state.summaryReceived === true     (else "agent did not call setSummary")
//       state.validationProblems.length === 0
//   - `drainLocalForgeAgentRun` (~597) runs `validateWorkspace` AFTER `harness.run`
//     and sets `validatedChangeCount`/`validatedWithWorkspaceCommands` itself when
//     `!state.validatedWithWorkspaceCommands || state.validatedChangeCount !== state.changeCount`.
//     It NEVER sets `state.validated`. The external CLI adapter never calls Forge's
//     plan/summary/validate tools, so THIS harness must set the flags the adapter
//     cannot: planReceived, summaryReceived, validated, summary, title, changeCount,
//     and streamedAssistantMessage (we call appendAssistantMessage once at the end).
//     We intentionally leave validatedChangeCount/validatedWithWorkspaceCommands at
//     their defaults so the drain runs real workspace-command validation and
//     reconciles them to the final changeCount.

import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chat } from '@tanstack/ai'
import type { StreamChunk } from '@tanstack/ai'
import { claudeCodeText } from '@tanstack/ai-claude-code'
import { codexText } from '@tanstack/ai-codex'
import {
  defineSandbox,
  defineWorkspace,
  withSandbox,
  withSandboxFileEvents,
} from '@tanstack/ai-sandbox'
import { localProcessSandbox } from '@tanstack/ai-sandbox-local-process'
import {
  normalizeSandboxFileChunk,
  reconcileSandboxWorkspace,
  seedSandboxWorkspaceDir,
} from './forge-sandbox-adapter'
import {
  LOCAL_FORGE_PROTECTED_WORKSPACE_PATHS,
  appendAgentEvent,
  appendAssistantMessage,
  type ForgeAgentHarnessRunInput,
} from './local-agent.server'

export type SandboxForgeHarnessKind = 'claude-code' | 'codex'

export function isSandboxForgeHarnessAvailable(
  kind: SandboxForgeHarnessKind,
): boolean {
  return kind === 'claude-code'
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY)
}

export function deriveSummaryFromAssistantText(text: string): {
  summary: string
  title: string
} {
  const trimmed = text.trim()
  const firstLine = trimmed.split('\n', 1)[0]?.trim() ?? ''
  return {
    summary: trimmed || 'Agent run complete.',
    title: (firstLine || 'Untitled app').slice(0, 80),
  }
}

/** Strip a leading host-dir prefix from a sandbox-emitted absolute path. */
function toDisplayPath(filePath: string, dir: string): string {
  const normalizedDir = dir.split(path.sep).join('/').replace(/\/+$/, '')
  const normalizedPath = filePath.split(path.sep).join('/')
  if (normalizedPath === normalizedDir) return ''
  if (normalizedPath.startsWith(`${normalizedDir}/`)) {
    return normalizedPath.slice(normalizedDir.length + 1)
  }
  return normalizedPath
}

export async function runSandboxForgeHarness(
  input: ForgeAgentHarnessRunInput & { kind: SandboxForgeHarnessKind },
): Promise<void> {
  const { kind, prompt, runContext, state, workspace } = input
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forge-sandbox-'))

  try {
    await seedSandboxWorkspaceDir({ dir, workspace })

    const sandbox = defineSandbox({
      id: runContext.runId,
      provider: localProcessSandbox({ dir, removeOnDestroy: false }),
      workspace: defineWorkspace({
        source: { type: 'local', path: dir },
        packageManager: 'pnpm',
        secrets: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
          OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
        },
      }),
      lifecycle: { reuse: 'none' },
    })

    const adapter =
      kind === 'claude-code'
        ? claudeCodeText('sonnet')
        : codexText('gpt-5.1-codex')

    const middleware = [withSandbox(sandbox), withSandboxFileEvents({ root: dir })]

    let assistantText = ''
    const toolNamesById = new Map<string, string>()
    const stream = chat({
      threadId: runContext.runId,
      adapter,
      messages: [{ role: 'user', content: prompt }],
      middleware,
    })

    for await (const rawChunk of stream as AsyncIterable<StreamChunk>) {
      const chunk = rawChunk as StreamChunk & {
        type: string
        name?: string
        value?: unknown
      }

      const fileOp = normalizeSandboxFileChunk(chunk)
      if (fileOp) {
        const displayPath = toDisplayPath(fileOp.path, dir)
        await appendAgentEvent({
          message: `${fileOp.kind === 'delete' ? 'Deleted' : 'Updated'} ${displayPath}`,
          name: `agent.file.${fileOp.kind}`,
          path: displayPath,
          runContext,
          status: 'running',
        })
        continue
      }

      switch (chunk.type) {
        case 'TEXT_MESSAGE_CONTENT': {
          const delta =
            typeof (chunk as { delta?: unknown }).delta === 'string'
              ? (chunk as { delta: string }).delta
              : ''
          assistantText += delta
          break
        }
        case 'TOOL_CALL_START': {
          const toolCall = chunk as {
            toolCallId: string
            toolCallName: string
          }
          toolNamesById.set(toolCall.toolCallId, toolCall.toolCallName)
          await appendAgentEvent({
            detail: 'Tool call started',
            message: `Started ${toolCall.toolCallName}`,
            name: `agent.tool.${toolCall.toolCallName}`,
            runContext,
            status: 'running',
            toolCallId: toolCall.toolCallId,
          })
          break
        }
        case 'TOOL_CALL_END': {
          const toolCall = chunk as {
            toolCallId: string
            toolCallName?: string
            toolName?: string
          }
          const toolName =
            toolCall.toolCallName ??
            toolCall.toolName ??
            toolNamesById.get(toolCall.toolCallId) ??
            'tool'
          await appendAgentEvent({
            message: `${toolName} call complete`,
            name: `agent.tool.${toolName}`,
            runContext,
            status: 'running',
            toolCallId: toolCall.toolCallId,
          })
          break
        }
        case 'RUN_ERROR': {
          const message =
            typeof (chunk as { message?: unknown }).message === 'string'
              ? (chunk as { message: string }).message
              : 'Model stream failed'
          throw new Error(message)
        }
        default:
          break
      }
    }

    const { changedPaths, deletedPaths } = await reconcileSandboxWorkspace({
      dir,
      workspace,
      protectedPaths: LOCAL_FORGE_PROTECTED_WORKSPACE_PATHS,
    })
    state.changeCount = changedPaths.length + deletedPaths.length

    const { summary, title } = deriveSummaryFromAssistantText(assistantText)
    state.summary = summary
    state.title = title
    state.planReceived = true
    state.summaryReceived = true
    state.validated = true

    await appendAssistantMessage({ runContext, text: state.summary })
    state.streamedAssistantMessage = true
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
