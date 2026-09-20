import { randomUUID } from 'node:crypto'
import {
  parseBuilderAiLocalValidationSubmission,
  type BuilderAiLocalValidationRequest,
  type BuilderAiLocalValidationSubmission,
} from '../src/utils/builder-ai-local-validation'
import type { BuilderAiValidationState } from '../src/utils/builder-ai-validation'

const maxCompletedRequestIds = 256

type PendingValidation = {
  resolve: (submission: BuilderAiLocalValidationSubmission) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  signal: AbortSignal
  abort: () => void
}

export class BuilderAiValidationSubmissionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export class BuilderAiValidationBroker {
  private pending = new Map<string, PendingValidation>()
  private completed = new Set<string>()
  private completedOrder: Array<string> = []

  constructor(private readonly timeoutMs: number) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Invalid builder validation timeout')
    }
  }

  waitForResult(
    state: BuilderAiValidationState,
    signal: AbortSignal,
    publish: (request: BuilderAiLocalValidationRequest) => void,
  ) {
    if (signal.aborted) {
      return Promise.reject(new Error('Builder edit was canceled'))
    }

    const requestId = this.createRequestId()
    return new Promise<BuilderAiLocalValidationSubmission>(
      (resolve, reject) => {
        const abort = () => {
          this.rejectPending(requestId, new Error('Builder edit was canceled'))
        }
        const timeout = setTimeout(() => {
          this.rejectPending(
            requestId,
            new Error('Builder validation timed out'),
          )
        }, this.timeoutMs)
        this.pending.set(requestId, {
          resolve,
          reject,
          timeout,
          signal,
          abort,
        })
        signal.addEventListener('abort', abort, { once: true })

        try {
          publish({ requestId, state })
        } catch (error) {
          this.rejectPending(requestId, toError(error))
        }
      },
    )
  }

  submit(value: unknown) {
    let submission: BuilderAiLocalValidationSubmission
    try {
      submission = parseBuilderAiLocalValidationSubmission(value)
    } catch {
      throw new BuilderAiValidationSubmissionError(
        400,
        'Invalid builder validation result',
      )
    }

    if (this.completed.has(submission.requestId)) {
      throw new BuilderAiValidationSubmissionError(
        409,
        'Builder validation result was already submitted',
      )
    }

    const pending = this.takePending(submission.requestId)
    if (!pending) {
      throw new BuilderAiValidationSubmissionError(
        404,
        'Builder validation request is not active',
      )
    }

    this.rememberCompleted(submission.requestId)
    pending.resolve(submission)
  }

  close(error = new Error('Builder validation broker closed')) {
    for (const requestId of [...this.pending.keys()]) {
      this.rejectPending(requestId, error)
    }
    this.completed.clear()
    this.completedOrder = []
  }

  private createRequestId() {
    let requestId = randomUUID()
    while (this.pending.has(requestId) || this.completed.has(requestId)) {
      requestId = randomUUID()
    }
    return requestId
  }

  private rejectPending(requestId: string, error: Error) {
    this.takePending(requestId)?.reject(error)
  }

  private takePending(requestId: string) {
    const pending = this.pending.get(requestId)
    if (!pending) return
    this.pending.delete(requestId)
    clearTimeout(pending.timeout)
    pending.signal.removeEventListener('abort', pending.abort)
    return pending
  }

  private rememberCompleted(requestId: string) {
    this.completed.add(requestId)
    this.completedOrder.push(requestId)
    if (this.completedOrder.length <= maxCompletedRequestIds) return
    const expired = this.completedOrder.shift()
    if (expired !== undefined) this.completed.delete(expired)
  }
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value))
}
