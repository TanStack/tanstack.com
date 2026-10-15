export type BuilderAiTurnIdleTimeout = {
  touch: () => void
  clear: () => void
}

export function createBuilderAiTurnIdleTimeout(
  timeoutMs: number,
  onTimeout: () => void,
): BuilderAiTurnIdleTimeout {
  let timeout = setTimeout(onTimeout, timeoutMs)

  return {
    touch() {
      clearTimeout(timeout)
      timeout = setTimeout(onTimeout, timeoutMs)
    },
    clear() {
      clearTimeout(timeout)
    },
  }
}

export function readBuilderAiTurnActivityThreadId(message: unknown) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return
  if (!('method' in message) || typeof message.method !== 'string') return
  if (!('params' in message)) return
  const params = message.params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return
  if (!('threadId' in params) || typeof params.threadId !== 'string') return
  return params.threadId
}
