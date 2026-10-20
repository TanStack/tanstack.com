/** Structural diagnostics only. No content, identifiers, URLs or tool names. */
export interface BindingRequestShape {
  version: 1
  boundary: 'cloudflare-binding'
  messageCount: number
  toolCount: number
  tailRoles: Array<
    'system' | 'developer' | 'user' | 'assistant' | 'tool' | 'unknown'
  >
  lastUserIndex?: number
  /** UTF-16 code units, not bytes or tokens. Absent for multimodal content. */
  lastUserTextCharacters?: number
}

/** Bounded JSON request observed at an SDK fetch hook. Counts describe provider
 * fields, not normalized conversation messages or tokenizer/billing quantities. */
export interface FetchRequestShape {
  version: 2
  boundary: 'provider-fetch'
  protocol: 'openai-chat' | 'openai-responses' | 'anthropic' | 'gemini'
  unit: 'utf8-json-bytes'
  requestBytes: number
  inputBytes: number
  toolBytes: number
  /** Separately serialized system/instructions field, absent when none exists. */
  instructionBytes?: number
  inputItemCount: number
  /** Number of top-level tool entries, not flattened callable functions. */
  toolEntryCount: number
  tailKinds: Array<
    | 'system'
    | 'developer'
    | 'user'
    | 'assistant'
    | 'model'
    | 'tool'
    | 'function_call'
    | 'function_call_output'
    | 'reasoning'
    | 'unknown'
  >
}
export type ProviderRequestShape = BindingRequestShape | FetchRequestShape
