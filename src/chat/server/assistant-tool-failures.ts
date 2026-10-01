import { recordToolEvidence } from '../core/tool-evidence'
import type { ChatMiddleware } from '@tanstack/ai'
import {
  assistantCallLimitReason,
  checkAssistantCall,
  type AssistantTask,
} from '../core/assistant-task'
import { observeAssistantToolProgress } from './assistant-progress'

function parsedArguments(value: string): unknown {
  try {
    const parsed = JSON.parse(value.trim() || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return value
  }
}

/** SDK validation failures return results without invoking either tool hook. */
export function assistantToolFailureMiddleware(options: {
  task: AssistantTask
  scope: { workspaceId: string; userId: string; conversationId: string }
  stop: (reason: string) => void
  save: () => Promise<void>
  reserveFailure?: (toolCallId: string) => Promise<void>
}): ChatMiddleware {
  const handled = new Set<string>()
  let stopped = false
  return {
    name: 'gum-tool-validation-limits',
    onAfterToolCall: (_ctx, call) => {
      if (!handled.has(call.toolCallId) && options.task.toolEvidence)
        recordToolEvidence(
          options.task.toolEvidence,
          call.toolName,
          call.ok,
          call.result,
        )
      handled.add(call.toolCallId)
    },
    onToolPhaseComplete: async (_ctx, phase) => {
      let changed = false
      for (const result of phase.results) {
        if (handled.has(result.toolCallId)) continue
        handled.add(result.toolCallId)
        if (
          !result.result ||
          typeof result.result !== 'object' ||
          !('error' in result.result) ||
          typeof result.result.error !== 'string'
        )
          continue
        const call = phase.toolCalls.find(
          (item) => item.id === result.toolCallId,
        )
        if (!call) continue
        try {
          await options.reserveFailure?.(result.toolCallId)
        } catch {
          stopped = true
          options.stop(
            'The task reached its shared operation limit or is no longer authorized.',
          )
          return
        }
        if (options.task.toolEvidence)
          recordToolEvidence(
            options.task.toolEvidence,
            result.toolName,
            false,
            result.result,
          )
        const args = parsedArguments(call.function.arguments)
        const limit = checkAssistantCall(options.task, result.toolName, args)
        options.task.repairs++
        changed = true
        const progress = await observeAssistantToolProgress(options.task, {
          scope: options.scope,
          name: result.toolName,
          args,
          ok: false,
          result: result.result,
        })
        const reason =
          limit ?? progress ?? assistantCallLimitReason(options.task)
        if (reason && !stopped) {
          stopped = true
          options.stop(reason)
        }
      }
      handled.clear()
      if (changed) await options.save()
    },
    onShouldContinue: () => (stopped ? false : undefined),
  }
}
