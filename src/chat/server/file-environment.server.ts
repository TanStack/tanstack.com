import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { SavedFileError, type FileEnvironment } from './saved-files'
function isFileBucket(value: unknown): value is FileEnvironment['FILES'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'put' in value &&
    typeof value.put === 'function' &&
    'get' in value &&
    typeof value.get === 'function' &&
    'head' in value &&
    typeof value.head === 'function'
  )
}
/** Reuse the site's R2 bucket. Immutable saved-files/ keys are separate from builder keys. */
export async function getFileEnvironment(): Promise<FileEnvironment> {
  const env = await getHostRuntimeEnv()
  if (!isFileBucket(env?.BUILDER_PROJECTS))
    throw new SavedFileError(
      'File storage is unavailable. Try again shortly.',
      503,
    )
  return { FILES: env.BUILDER_PROJECTS }
}
