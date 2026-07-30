import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const localDocsDevPath = '/__tanstack-local-docs'
export const localDocsDevTokenHeader = 'x-tanstack-local-docs-token'

export function getImportFallbackRepoDirs(moduleUrl: string, repo: string) {
  const fallbackParent = path.resolve(
    path.dirname(fileURLToPath(moduleUrl)),
    '../../..',
  )

  return Array.from(
    new Set([
      ...(path.basename(fallbackParent) === repo ? [fallbackParent] : []),
      path.resolve(fallbackParent, repo),
    ]),
  )
}
