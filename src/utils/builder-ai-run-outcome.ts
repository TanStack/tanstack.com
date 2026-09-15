import type { RunFinishedEvent } from '@tanstack/ai'

type BuilderAiRunOutcome =
  | { status: 'continue' | 'interrupt' | 'complete' }
  | { status: 'failed'; message: string }

// A provider turn ending is not necessarily the Builder task completing.
// Keep the server and browser on the same interpretation of the protocol.
export function getBuilderAiRunOutcome(
  event: RunFinishedEvent,
): BuilderAiRunOutcome {
  const reason = event.metadata?.tanstack?.finishReason ?? event.finishReason
  if (event.outcome?.type === 'interrupt') return { status: 'interrupt' }
  if (event.outcome && event.outcome.type !== 'success') {
    return {
      status: 'failed',
      message: 'The provider stopped the run without completing it.',
    }
  }
  if (reason === 'tool_calls') return { status: 'continue' }
  if (reason === 'length') {
    return {
      status: 'failed',
      message: 'The model reached its response limit before finishing.',
    }
  }
  if (reason === 'content_filter') {
    return {
      status: 'failed',
      message:
        'The provider stopped the response because of its content policy.',
    }
  }
  if (reason === 'stop' || (!reason && event.outcome?.type === 'success')) {
    return { status: 'complete' }
  }
  return {
    status: 'failed',
    message: 'The provider ended the response without confirming completion.',
  }
}
