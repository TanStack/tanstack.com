import * as v from 'valibot'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { queryOptions } from '@tanstack/react-query'
import {
  fetchRepoFile,
  isRecoverableGitHubContentError,
} from './documents.server'
import { getBranch, getLibrary } from '~/libraries'

// Mirrors scripts/generate-coverage.ts in TanStack/ai.
const modalitiesSchema = v.object({
  input: v.array(v.string()),
  output: v.array(v.string()),
})

const coverageSchema = v.object({
  generatedAt: v.string(),
  activities: v.array(v.string()),
  adapters: v.array(
    v.object({
      id: v.string(),
      package: v.string(),
      name: v.string(),
      docs: v.string(),
      note: v.optional(v.string()),
      activities: v.record(v.string(), v.array(v.string())),
      models: v.record(v.string(), modalitiesSchema),
    }),
  ),
})

export type AiCoverage = v.InferOutput<typeof coverageSchema>
export type AiCoverageAdapter = AiCoverage['adapters'][number]

const COVERAGE_FILE = 'adapter-coverage.json'

export const fetchAiCoverage = createServerFn({ method: 'GET' })
  .validator(v.object({ repo: v.string(), branch: v.string() }))
  .handler(async ({ data }): Promise<AiCoverage | null> => {
    const { repo, branch } = data

    let file: string | null
    try {
      file = await fetchRepoFile(repo, branch, COVERAGE_FILE)
    } catch (error) {
      if (!isRecoverableGitHubContentError(error)) {
        throw error
      }
      return null
    }

    if (!file) {
      return null
    }

    const parsed = v.safeParse(coverageSchema, JSON.parse(file))
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.issues, null, 2))
      return null
    }

    setResponseHeaders(
      new Headers({
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Cloudflare-CDN-Cache-Control':
          'public, max-age=300, stale-while-revalidate=300',
        // Same tags as the docs so the docs webhook invalidates this too.
        'Cache-Tag': ['docs:all', 'docs:ai', `docs:ai:branch:${branch}`].join(
          ',',
        ),
      }),
    )

    return parsed.output
  })

export function aiCoverageQueryOptions(version: string) {
  const library = getLibrary('ai')
  const branch = getBranch(library, version)

  return queryOptions({
    queryKey: ['ai-coverage', library.repo, branch],
    queryFn: () => fetchAiCoverage({ data: { repo: library.repo, branch } }),
    staleTime: 1000 * 60 * 5,
  })
}
