import { z } from 'zod'

export const maxConversationReferenceCursorLength = 16384
export const maxConversationReferenceCursorBytes = 12288

const cursorFields = {
  conversationId: z.string().min(1).max(1000),
  transcriptEpoch: z.string().min(1).max(128),
  before: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  revision: z.string().min(1).max(200).optional(),
}
const cursorSchema = z
  .object(cursorFields)
  .strict()
  .refine(
    (value) => value.offset === 0 || value.revision !== undefined,
    'Continuing a window requires its revision.',
  )
const wireSchema = z.object({ version: z.literal(1), ...cursorFields }).strict()

export type ConversationReferenceCursor = z.infer<typeof cursorSchema>

export class ConversationReferenceCursorError extends Error {
  constructor() {
    super('The conversation cursor is invalid.')
    this.name = 'ConversationReferenceCursorError'
  }
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/** A cursor names one source and snapshot window, never permission to read it.
 * Field order and encoding are fixed so a token has only one representation. */
export function encodeConversationReferenceCursor(
  input: ConversationReferenceCursor,
): string {
  const parsed = cursorSchema.safeParse(input)
  if (!parsed.success) throw new ConversationReferenceCursorError()
  const value = parsed.data
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      conversationId: value.conversationId,
      transcriptEpoch: value.transcriptEpoch,
      ...(value.before === undefined ? {} : { before: value.before }),
      offset: value.offset,
      ...(value.revision === undefined ? {} : { revision: value.revision }),
    }),
  )
  if (bytes.length > maxConversationReferenceCursorBytes)
    throw new ConversationReferenceCursorError()
  const token = base64url(bytes)
  if (token.length > maxConversationReferenceCursorLength)
    throw new ConversationReferenceCursorError()
  return token
}

export function decodeConversationReferenceCursor(
  token: string,
): ConversationReferenceCursor {
  try {
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > maxConversationReferenceCursorLength ||
      !/^[A-Za-z0-9_-]+$/.test(token)
    )
      throw new ConversationReferenceCursorError()
    const binary = atob(token.replaceAll('-', '+').replaceAll('_', '/'))
    if (binary.length > maxConversationReferenceCursorBytes)
      throw new ConversationReferenceCursorError()
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    )
    const json = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes)
    const wire = wireSchema.parse(JSON.parse(json))
    const { version: _, ...fields } = wire
    const value = cursorSchema.parse(fields)
    // Reject whitespace, duplicate/reordered keys, alternate escapes, a BOM,
    // noncanonical trailing bits, and any other encoding of the same fields.
    if (encodeConversationReferenceCursor(value) !== token)
      throw new ConversationReferenceCursorError()
    return value
  } catch {
    throw new ConversationReferenceCursorError()
  }
}
