export type BuilderAiSendMode = 'queue' | 'steer'

export interface BuilderAiPromptLifecycle {
  readonly onDiscarded?: () => void
}

export interface BuilderAiQueuedPrompt {
  readonly id: string
  readonly content: string
  readonly createdAt: number
  readonly lifecycle?: BuilderAiPromptLifecycle
  readonly mode: BuilderAiSendMode
}

export class BuilderAiPromptQueue {
  private claimed = false
  private readonly steering: Array<BuilderAiQueuedPrompt> = []
  private readonly queued: Array<BuilderAiQueuedPrompt> = []

  get active() {
    return this.claimed
  }

  get items(): ReadonlyArray<BuilderAiQueuedPrompt> {
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
    mode: BuilderAiSendMode,
    lifecycle?: BuilderAiPromptLifecycle,
  ) {
    const item: BuilderAiQueuedPrompt = {
      id: crypto.randomUUID(),
      content,
      createdAt: Date.now(),
      lifecycle,
      mode,
    }

    this.enqueuePrompt(item)
    return item
  }

  enqueuePrompt(prompt: BuilderAiQueuedPrompt) {
    if (prompt.mode === 'steer') {
      this.steering.push(prompt)
    } else {
      this.queued.push(prompt)
    }
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
