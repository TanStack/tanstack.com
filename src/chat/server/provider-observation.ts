import type { CacheUsage } from '../core/usage'
import type { ProviderRequestShape } from '../core/provider-request-shape'
import {
  bindingRequestShape,
  fetchRequestShape,
} from './provider-request-shape'
export type ProviderProtocol =
  | 'openai-chat'
  | 'openai-responses'
  | 'anthropic'
  | 'gemini'

export interface ProviderObservation {
  thinkingTokens?: number
  cacheUsage?: CacheUsage
  usagePresent: boolean
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
  providerFinished: boolean
  finishReason?: string
  httpStatus?: number
  bodyState: 'pending' | 'complete' | 'incomplete' | 'failed' | 'cancelled'
  usageInvalid?: boolean
}
export interface ProviderAttemptRecorder {
  update(snapshot: ProviderObservation): void
}
export interface ProviderAttemptObserver {
  start(
    protocol: ProviderProtocol,
    requestShape?: ProviderRequestShape,
  ): ProviderAttemptRecorder
}

// These limits bound observation only. Larger provider content still reaches the SDK unchanged.
const maxFrameCharacters = 256 * 1024
const maxJsonCharacters = 1024 * 1024
const decodeChunkBytes = 16 * 1024
const finishReasons = new Set([
  'stop',
  'length',
  'tool_calls',
  'function_call',
  'content_filter',
  'completed',
  'failed',
  'incomplete',
  'cancelled',
  'error',
  'max_output_tokens',
  'end_turn',
  'max_tokens',
  'stop_sequence',
  'tool_use',
  'pause_turn',
  'refusal',
  'model_context_window_exceeded',
  'compaction',
  'STOP',
  'MAX_TOKENS',
  'SAFETY',
  'RECITATION',
  'LANGUAGE',
  'OTHER',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'MALFORMED_FUNCTION_CALL',
  'IMAGE_SAFETY',
  'UNEXPECTED_TOOL_CALL',
  'NO_IMAGE',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_OTHER',
  'IMAGE_RECITATION',
])
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

class Observation {
  private state: ProviderObservation = {
    usagePresent: false,
    providerFinished: false,
    bodyState: 'pending',
  }
  private lastSnapshot = ''
  private finished = false
  private incomplete = false
  private providerError = false
  private mode: 'sse' | 'json' | 'unsupported' = 'unsupported'
  private decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
  private decodingFailed = false
  private json = ''
  private line = ''
  private lineHasCharacters = false
  private skipLf = false
  private event = ''
  private data: string[] = []
  private frameSize = 0
  private frameOverflow = false

  constructor(
    private protocol: ProviderProtocol,
    private recorder: ProviderAttemptRecorder,
  ) {
    this.publish()
  }

  private publish() {
    const serialized = JSON.stringify(this.state)
    if (serialized === this.lastSnapshot) return
    this.lastSnapshot = serialized
    // Accounting failures are handled by the recorder's owner, outside SDK transport/retry logic.
    try {
      this.recorder.update({ ...this.state })
    } catch {}
  }

  response(response: Response) {
    this.state.httpStatus = response.status
    if (!response.ok) this.providerError = true
    const contentType = (response.headers.get('content-type') ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase()
    this.mode =
      contentType === 'text/event-stream'
        ? 'sse'
        : contentType === 'application/json' || contentType.endsWith('+json')
          ? 'json'
          : 'unsupported'
    if (this.mode === 'unsupported') this.incomplete = true
    this.publish()
  }

  private terminal(reason?: unknown, failed = false) {
    this.state.providerFinished = true
    if (typeof reason === 'string' && finishReasons.has(reason))
      this.state.finishReason = reason
    if (failed) this.providerError = true
  }

  private usage(
    value: unknown,
    names: { input: string; output: string; total?: string },
  ) {
    // Streaming APIs commonly report usage:null before their final usage frame.
    if (value === undefined || value === null) return
    this.state.usagePresent = true
    const usage = object(value)
    if (!usage) {
      this.state.usageInvalid = true
      return
    }
    const cacheSources: Array<[keyof CacheUsage, unknown]> =
      this.protocol === 'anthropic'
        ? [
            ['readTokens', usage.cache_read_input_tokens],
            ['writeTokens', usage.cache_creation_input_tokens],
            [
              'write5mTokens',
              object(usage.cache_creation)?.ephemeral_5m_input_tokens,
            ],
            [
              'write1hTokens',
              object(usage.cache_creation)?.ephemeral_1h_input_tokens,
            ],
          ]
        : this.protocol === 'openai-chat' ||
            this.protocol === 'openai-responses'
          ? [
              [
                'readTokens',
                object(
                  usage.prompt_tokens_details ?? usage.input_tokens_details,
                )?.cached_tokens,
              ],
              [
                'writeTokens',
                object(
                  usage.prompt_tokens_details ?? usage.input_tokens_details,
                )?.cache_write_tokens,
              ],
            ]
          : this.protocol === 'gemini'
            ? [['readTokens', usage.cachedContentTokenCount]]
            : []
    for (const [key, count] of cacheSources) {
      if (count === undefined) continue
      if (
        typeof count !== 'number' ||
        !Number.isSafeInteger(count) ||
        count < 0
      ) {
        this.state.usageInvalid = true
        continue
      }
      this.state.cacheUsage = { ...this.state.cacheUsage, [key]: count }
    }
    const fields = [
      ['inputTokens', names.input],
      ['outputTokens', names.output],
      ['totalTokens', names.total],
      ['cost', 'cost'],
      [
        'thinkingTokens',
        this.protocol === 'gemini' ? 'thoughtsTokenCount' : undefined,
      ],
    ] as const
    for (const [target, source] of fields) {
      if (!source || !Object.prototype.hasOwnProperty.call(usage, source))
        continue
      const count = usage[source]
      if (
        typeof count !== 'number' ||
        !Number.isFinite(count) ||
        count < 0 ||
        count > Number.MAX_SAFE_INTEGER ||
        (target !== 'cost' && !Number.isSafeInteger(count))
      ) {
        this.state.usageInvalid = true
        continue
      }
      // Provider usage frames are cumulative snapshots, not additional charges.
      this.state[target] = count
    }
  }

  private inspect(
    value: unknown,
    eventName = '',
    jsonBody = false,
    allowArray = true,
  ) {
    if (this.protocol === 'gemini' && Array.isArray(value)) {
      if (!allowArray) {
        this.incomplete = true
        return
      }
      for (const item of value) this.inspect(item, eventName, jsonBody, false)
      return
    }
    const row = object(value)
    if (!row) {
      this.incomplete = true
      return
    }
    const event = typeof row.type === 'string' ? row.type : eventName
    if (
      event === 'error' ||
      row.error !== undefined ||
      (row.success === false && Array.isArray(row.errors))
    )
      this.terminal('error', true)
    switch (this.protocol) {
      case 'openai-chat': {
        const result = object(row.result)
        const message = result ?? row
        this.usage(message.usage ?? object(message.x_groq)?.usage, {
          input: 'prompt_tokens',
          output: 'completion_tokens',
          total: 'total_tokens',
        })
        if (Array.isArray(message.choices))
          for (const choice of message.choices) {
            const reason = object(choice)?.finish_reason
            if (typeof reason === 'string' && reason) {
              // Chat SSE can send usage after finish_reason. Its [DONE] sentinel,
              // not a clean but possibly truncated EOF, closes that response.
              if (jsonBody) this.terminal(reason)
              else if (finishReasons.has(reason))
                this.state.finishReason = reason
            }
          }
        // Workers AI's non-streaming response envelope, not its usage-only SSE trailer.
        if (jsonBody && typeof message.response === 'string') this.terminal()
        break
      }
      case 'openai-responses': {
        const response = object(row.response) ?? row
        this.usage(response.usage, {
          input: 'input_tokens',
          output: 'output_tokens',
          total: 'total_tokens',
        })
        const status = response.status
        if (
          [
            'response.completed',
            'response.failed',
            'response.incomplete',
          ].includes(event)
        ) {
          const failed = event === 'response.failed'
          this.terminal(
            object(response.incomplete_details)?.reason ??
              event.slice('response.'.length),
            failed,
          )
        } else if (
          jsonBody &&
          ['completed', 'failed', 'incomplete', 'cancelled'].includes(
            String(status),
          )
        ) {
          this.terminal(
            object(response.incomplete_details)?.reason ?? status,
            status === 'failed' || status === 'cancelled',
          )
        }
        break
      }
      case 'anthropic': {
        const message = object(row.message)
        if (event === 'message_start')
          this.usage(message?.usage, {
            input: 'input_tokens',
            output: 'output_tokens',
          })
        this.usage(row.usage, {
          input: 'input_tokens',
          output: 'output_tokens',
        })
        const reason = object(row.delta)?.stop_reason ?? row.stop_reason
        if (typeof reason === 'string' && reason) {
          if (finishReasons.has(reason)) this.state.finishReason = reason
          if (jsonBody) this.terminal(reason)
        }
        if (event === 'message_stop') this.terminal()
        break
      }
      case 'gemini': {
        this.usage(row.usageMetadata, {
          input: 'promptTokenCount',
          output: 'candidatesTokenCount',
          total: 'totalTokenCount',
        })
        if (Array.isArray(row.candidates))
          for (const candidate of row.candidates) {
            const reason = object(candidate)?.finishReason
            if (
              typeof reason === 'string' &&
              reason &&
              reason !== 'FINISH_REASON_UNSPECIFIED'
            )
              this.terminal(reason)
          }
        const block = object(row.promptFeedback)?.blockReason
        if (
          typeof block === 'string' &&
          block &&
          block !== 'BLOCK_REASON_UNSPECIFIED'
        )
          this.terminal(block)
        break
      }
    }
    this.publish()
  }

  private dispatch() {
    if (this.frameOverflow) this.incomplete = true
    else if (this.data.length) {
      const data = this.data.join('\n')
      if (data.trim() === '[DONE]' && this.protocol === 'openai-chat')
        this.terminal()
      else {
        try {
          this.inspect(JSON.parse(data), this.event)
        } catch {
          this.incomplete = true
        }
      }
    }
    this.event = ''
    this.data = []
    this.frameSize = 0
    this.frameOverflow = false
    this.publish()
  }

  private consumeLine() {
    if (!this.lineHasCharacters) {
      this.dispatch()
      return
    }
    if (!this.frameOverflow) {
      if (this.line.startsWith('data:'))
        this.data.push(this.line.slice(5).replace(/^ /, ''))
      else if (this.line.startsWith('event:'))
        this.event = this.line.slice(6).trim().slice(0, 64)
    }
    this.line = ''
    this.lineHasCharacters = false
  }

  private text(value: string) {
    if (this.mode === 'json') {
      if (this.json.length + value.length > maxJsonCharacters) {
        this.incomplete = true
        this.decodingFailed = true
        this.json = ''
        return
      }
      this.json += value
      return
    }
    for (const character of value) {
      if (this.skipLf) {
        this.skipLf = false
        if (character === '\n') continue
      }
      if (character === '\r' || character === '\n') {
        this.consumeLine()
        this.skipLf = character === '\r'
      } else {
        this.lineHasCharacters = true
        this.frameSize += character.length
        if (this.frameSize > maxFrameCharacters) {
          this.incomplete = true
          this.frameOverflow = true
          this.line = ''
          this.data = []
          this.event = ''
        }
        if (!this.frameOverflow) this.line += character
      }
    }
  }

  push(bytes: Uint8Array) {
    if (this.finished || this.mode === 'unsupported' || this.decodingFailed)
      return
    try {
      for (
        let offset = 0;
        offset < bytes.byteLength && !this.decodingFailed;
        offset += decodeChunkBytes
      )
        this.text(
          this.decoder.decode(
            bytes.subarray(offset, offset + decodeChunkBytes),
            { stream: true },
          ),
        )
    } catch {
      this.incomplete = true
      this.decodingFailed = true
      this.json = ''
      this.line = ''
      this.data = []
    }
  }

  value(value: unknown) {
    try {
      this.inspect(value, '', true)
    } catch {
      this.incomplete = true
    }
  }

  finish(state: 'complete' | 'failed' | 'cancelled' | 'incomplete') {
    if (this.finished) return
    if (
      state === 'complete' &&
      this.mode !== 'unsupported' &&
      !this.decodingFailed
    ) {
      try {
        this.text(this.decoder.decode())
        if (this.mode === 'json') this.inspect(JSON.parse(this.json), '', true)
        else if (
          this.lineHasCharacters ||
          this.data.length ||
          this.frameOverflow
        ) {
          // A terminal event without its SSE delimiter is still a truncated frame.
          this.incomplete = true
          if (this.lineHasCharacters) this.consumeLine()
          this.dispatch()
        }
      } catch {
        this.incomplete = true
      }
    }
    this.finished = true
    this.state.bodyState =
      state !== 'complete'
        ? state
        : this.providerError
          ? 'failed'
          : this.incomplete || !this.state.providerFinished
            ? 'incomplete'
            : 'complete'
    this.json = ''
    this.line = ''
    this.data = []
    this.event = ''
    this.publish()
  }
}

function observedResponse(
  response: Response,
  observation: Observation,
  signal?: AbortSignal | null,
): Response {
  observation.response(response)
  if (!response.body || response.status < 200 || response.status > 599) {
    observation.finish('complete')
    return response
  }
  const reader = response.body.getReader()
  let released = false
  let stopped = false
  const release = () => {
    if (!released) {
      released = true
      reader.releaseLock()
    }
  }
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const item = await reader.read()
        if (stopped) return
        if (item.done) {
          stopped = true
          observation.finish('complete')
          controller.close()
          release()
        } else {
          observation.push(item.value)
          controller.enqueue(item.value)
        }
      } catch (error) {
        if (stopped) return
        stopped = true
        observation.finish(signal?.aborted ? 'cancelled' : 'failed')
        controller.error(error)
        release()
      }
    },
    async cancel(reason) {
      stopped = true
      observation.finish('cancelled')
      try {
        await reader.cancel(reason)
      } finally {
        release()
      }
    },
  })
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export function observeProviderFetch(
  protocol: ProviderProtocol,
  observer: ProviderAttemptObserver,
  fetchImpl: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input, init) => {
    // Start is intentionally outside catch: a failed accounting start must prevent dispatch.
    const observation = new Observation(
      protocol,
      observer.start(protocol, fetchRequestShape(protocol, init?.body)),
    )
    const signal =
      init?.signal ?? (input instanceof Request ? input.signal : undefined)
    try {
      return observedResponse(await fetchImpl(input, init), observation, signal)
    } catch (error) {
      observation.finish(signal?.aborted ? 'cancelled' : 'failed')
      throw error
    }
  }
}

export function observeProviderBinding<
  T extends { run: (...args: any[]) => Promise<any> },
>(binding: T, observer: ProviderAttemptObserver): T {
  return new Proxy(binding, {
    get(target, key) {
      if (key === 'run')
        return async (...args: Parameters<T['run']>) => {
          const observation = new Observation(
            'openai-chat',
            observer.start('openai-chat', bindingRequestShape(args[1])),
          )
          try {
            const value = await target.run(...args)
            if (value instanceof Response)
              return observedResponse(value, observation)
            observation.value(value)
            observation.finish('complete')
            return value
          } catch (error) {
            observation.finish('failed')
            throw error
          }
        }
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
