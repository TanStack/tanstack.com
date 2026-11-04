import type {
  BindingRequestShape,
  FetchRequestShape,
} from '../core/provider-request-shape'

const roles = new Set(['system', 'developer', 'user', 'assistant', 'tool'])
const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

export function bindingRequestShape(
  input: unknown,
): BindingRequestShape | undefined {
  const body = record(input)
  if (
    !body ||
    !Array.isArray(body.messages) ||
    body.messages.length > 4096 ||
    (body.tools !== undefined && !Array.isArray(body.tools))
  )
    return undefined
  const messages = body.messages
  const shape: BindingRequestShape = {
    version: 1,
    boundary: 'cloudflare-binding',
    messageCount: messages.length,
    toolCount: Array.isArray(body.tools) ? body.tools.length : 0,
    tailRoles: messages.slice(-16).map((value) => {
      const role = record(value)?.role
      return typeof role === 'string' && roles.has(role)
        ? (role as BindingRequestShape['tailRoles'][number])
        : 'unknown'
    }),
  }
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = record(messages[index])
    if (message?.role !== 'user') continue
    shape.lastUserIndex = index
    if (typeof message.content === 'string')
      shape.lastUserTextCharacters = message.content.length
    break
  }
  return shape
}

const encoder = new TextEncoder()
const fetchKinds = new Set([
  'system',
  'developer',
  'user',
  'assistant',
  'model',
  'tool',
  'function_call',
  'function_call_output',
  'reasoning',
])
/** Inspect only an already-materialized JSON string. Never clone/consume a
 * Request or stream. Oversized/unsupported diagnostics do not block dispatch. */
export function fetchRequestShape(
  protocol: FetchRequestShape['protocol'],
  raw: unknown,
): FetchRequestShape | undefined {
  if (typeof raw !== 'string' || raw.length > 1024 * 1024) return undefined
  try {
    const body = record(JSON.parse(raw))
    if (!body) return undefined
    const input =
      protocol === 'openai-responses'
        ? body.input
        : protocol === 'gemini'
          ? body.contents
          : body.messages
    const items =
      typeof input === 'string' && protocol === 'openai-responses'
        ? [{ role: 'user' }]
        : input
    if (
      !Array.isArray(items) ||
      items.length > 4096 ||
      (body.tools !== undefined &&
        (!Array.isArray(body.tools) || body.tools.length > 4096))
    )
      return undefined
    const instructions =
      protocol === 'anthropic'
        ? body.system
        : protocol === 'openai-responses'
          ? body.instructions
          : protocol === 'gemini'
            ? body.systemInstruction
            : undefined
    const bytes = (value: unknown) =>
      encoder.encode(JSON.stringify(value)).byteLength
    return {
      version: 2,
      boundary: 'provider-fetch',
      protocol,
      unit: 'utf8-json-bytes',
      requestBytes: encoder.encode(raw).byteLength,
      inputBytes: bytes(input),
      toolBytes: body.tools === undefined ? 0 : bytes(body.tools),
      ...(instructions === undefined
        ? {}
        : { instructionBytes: bytes(instructions) }),
      inputItemCount: items.length,
      toolEntryCount: Array.isArray(body.tools) ? body.tools.length : 0,
      tailKinds: items.slice(-16).map((item) => {
        const value = record(item)
        const kind = typeof value?.role === 'string' ? value.role : value?.type
        return typeof kind === 'string' && fetchKinds.has(kind)
          ? (kind as FetchRequestShape['tailKinds'][number])
          : 'unknown'
      }),
    }
  } catch {
    return undefined
  }
}
