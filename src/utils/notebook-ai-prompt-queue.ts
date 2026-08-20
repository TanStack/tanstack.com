export type NotebookAiSendMode = 'queue' | 'steer'

export interface NotebookAiPromptLifecycle {
  readonly onDiscarded?: () => void
}

export interface NotebookAiQueuedPrompt {
  readonly id: string
  readonly content: string
  readonly createdAt: number
  readonly lifecycle?: NotebookAiPromptLifecycle
  readonly mode: NotebookAiSendMode
}

export class NotebookAiPromptQueue {
  private claimed = false
  private readonly steering: Array<NotebookAiQueuedPrompt> = []
  private readonly queued: Array<NotebookAiQueuedPrompt> = []

  get active() {
    return this.claimed
  }

  get items(): ReadonlyArray<NotebookAiQueuedPrompt> {
    return [...this.steering, ...this.queued]
  }

  claim() {
    if (this.claimed) return false
    this.claimed = true
    return true
  }

  release() {
    this.claimed = false
  }

  enqueue(
    content: string,
    mode: NotebookAiSendMode,
    lifecycle?: NotebookAiPromptLifecycle,
  ) {
    const item: NotebookAiQueuedPrompt = {
      id: crypto.randomUUID(),
      content,
      createdAt: Date.now(),
      lifecycle,
      mode,
    }

    if (mode === 'steer') {
      this.steering.push(item)
    } else {
      this.queued.push(item)
    }

    return item
  }

  take() {
    return this.steering.shift() ?? this.queued.shift()
  }

  cancel(id: string) {
    const steeringIndex = this.steering.findIndex((item) => item.id === id)
    if (steeringIndex !== -1) {
      this.steering.splice(steeringIndex, 1)[0]?.lifecycle?.onDiscarded?.()
      return true
    }

    const queuedIndex = this.queued.findIndex((item) => item.id === id)
    if (queuedIndex === -1) return false
    this.queued.splice(queuedIndex, 1)[0]?.lifecycle?.onDiscarded?.()
    return true
  }

  clear() {
    const discarded = this.items
    this.steering.length = 0
    this.queued.length = 0
    for (const prompt of discarded) prompt.lifecycle?.onDiscarded?.()
    return discarded.length
  }
}
