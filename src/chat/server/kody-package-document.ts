import { z } from 'zod'
import {
  kodyPackageDocumentKindSchema,
  kodyPackageDocumentSchema,
  type KodyPackageDocumentKind,
} from '../core/kody-package-document'
import { KodyConnectionError, kodyCall, type KodyEnvironment } from './kody'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'
import {
  kodyPackageFileResponseSchema,
  kodyPackageIndexResponseSchema,
  safeKodyPackagePath,
} from './kody-package-recovery'

export class KodyPackageDocumentError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
    this.name = 'KodyPackageDocumentError'
  }
}

const packageIdSchema = z.uuid()

/** Read only the selected package's declared README or root agent instructions. */
export async function readKodyPackageDocument(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  packageId: string,
  kind: KodyPackageDocumentKind,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const id = packageIdSchema.parse(packageId)
  const documentKind = kodyPackageDocumentKindSchema.parse(kind)
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyPackageDocumentError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to read package documents.',
      409,
    )

  const search = (entity: string) =>
    call(
      env,
      scope.userId,
      'search',
      { entity, maxResponseSize: 50000 },
      signal,
    )
  try {
    const index = kodyPackageIndexResponseSchema.safeParse(
      await search(`package:${id}`),
    )
    if (
      !index.success ||
      index.data.isError ||
      index.data.structuredContent.result.packageId !== id
    )
      throw new KodyPackageDocumentError(
        'Kody package changed. Try again.',
        409,
      )
    const path =
      documentKind === 'readme'
        ? index.data.structuredContent.result.readmeIntent?.path
        : index.data.structuredContent.result.agentsDocs?.path
    if (!path || !safeKodyPackagePath(path))
      throw new KodyPackageDocumentError(
        'This package has no readable document for that section.',
        404,
      )
    const file = kodyPackageFileResponseSchema.safeParse(
      await search(`package:${id}#${path}`),
    )
    if (
      !file.success ||
      file.data.isError ||
      file.data.structuredContent.result.packageId !== id ||
      file.data.structuredContent.result.path !== path
    )
      throw new KodyPackageDocumentError(
        'Kody document changed. Try again.',
        409,
      )
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
    const { content, truncated } = file.data.structuredContent.result
    return kodyPackageDocumentSchema.parse({
      path,
      content: content.slice(0, 20000),
      excerpted: truncated === true || content.length > 20000,
    })
  } catch (error) {
    if (error instanceof KodyPackageDocumentError) throw error
    if (error instanceof KodyConnectionError)
      throw new KodyPackageDocumentError(error.message, 409)
    if (
      error instanceof Error &&
      error.message === 'Kody connection or access changed. Try again.'
    )
      throw new KodyPackageDocumentError(error.message, 409)
    throw new KodyPackageDocumentError(
      'Kody package document could not be read right now.',
    )
  }
}
