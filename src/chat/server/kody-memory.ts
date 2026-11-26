import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import {
  kodyMemoryDetailSchema,
  kodyMemoryIdSchema,
  kodyMemoryQuerySchema,
  kodyMemorySearchSchema,
} from '../core/kody-memory'
import { KodyConnectionError, kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

export class KodyMemoryError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
    this.name = 'KodyMemoryError'
  }
}

export const KODY_MEMORY_SEARCH_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const result = await kody.metaMemorySearch({ query: params.query, limit: 20 })
  return { items: result.matches.map(memory => ({
    id: memory.id,
    status: memory.status,
    subject: memory.subject,
    summary: memory.summary,
    category: memory.category,
    updatedAt: memory.updated_at,
    canMutate: memory.can_mutate === true,
  })) }
}`

export const KODY_MEMORY_GET_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const memory = await kody.metaMemoryGet({ memory_id: params.id })
  if (!memory) return null
  return {
    id: memory.id,
    status: memory.status,
    subject: memory.subject,
    summary: memory.summary,
    details: memory.details,
    category: memory.category,
    tags: memory.tags,
    createdAt: memory.created_at,
    updatedAt: memory.updated_at,
    sourceUris: memory.source_uris || [],
  }
}`

function result(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyMemoryError('Kody memory could not be read.')
  return envelope.data.structuredContent.result
}

export function projectKodyMemorySearch(raw: unknown) {
  const parsed = kodyMemorySearchSchema.safeParse(result(raw))
  if (!parsed.success)
    throw new KodyMemoryError('Kody returned an unsupported memory search.')
  return parsed.data
}

export function projectKodyMemoryDetail(raw: unknown, id: string) {
  const value = result(raw)
  if (value === null)
    throw new KodyMemoryError('Memory was not found in Kody.', 404)
  const parsed = kodyMemoryDetailSchema.safeParse(value)
  if (!parsed.success || parsed.data.id !== id)
    throw new KodyMemoryError('Kody returned an unsupported memory record.')
  return parsed.data
}

async function read(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  code: string,
  params: Record<string, unknown>,
  signal: AbortSignal,
  call: typeof kodyCall,
) {
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyMemoryError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to search your memory.',
      409,
    )
  try {
    const response = await call(
      env,
      scope.userId,
      'execute',
      kodyInternalReadArgs({ code, params, responseLimit: 100000 }),
      signal,
    )
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
    return response
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyMemoryError(error.message, 409)
    if (
      error instanceof Error &&
      error.message === 'Kody connection or access changed. Try again.'
    )
      throw new KodyMemoryError(error.message, 409)
    if (error instanceof KodyMemoryError) throw error
    throw new KodyMemoryError('Kody memory could not be checked right now.')
  }
}

export async function searchKodyMemory(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  query: string,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const input = kodyMemoryQuerySchema.parse(query)
  return projectKodyMemorySearch(
    await read(
      env,
      scope,
      options,
      KODY_MEMORY_SEARCH_CODE,
      { query: input },
      signal,
      call,
    ),
  )
}

export async function getKodyMemory(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  id: string,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const input = kodyMemoryIdSchema.parse(id)
  return projectKodyMemoryDetail(
    await read(
      env,
      scope,
      options,
      KODY_MEMORY_GET_CODE,
      { id: input },
      signal,
      call,
    ),
    input,
  )
}
