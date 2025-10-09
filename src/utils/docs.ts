import {
  extractFrontMatter,
  fetchApiContents,
  fetchRepoFile,
} from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { setHeader } from '@tanstack/react-start/server'
// import {
//   getContributorStats,
//   getContributorStatsForLibrary,
//   getBatchContributorStats,
//   type ContributorStats,
// } from '~/server/github'

export const loadDocs = async ({
  repo,
  branch,
  // currentPath,
  // redirectPath,
  docsPath,
}: {
  repo: string
  branch: string
  docsPath: string
  currentPath: string
  redirectPath: string
}) => {
  if (!branch || !docsPath) {
    throw notFound({
      data: {
        message: 'No doc was found here!',
      },
    })
  }

  const filePath = `${docsPath}.md`

  return await fetchDocs({
    data: {
      repo,
      branch,
      filePath,
      // currentPath,
      // redirectPath,
    },
  })
}

export const fetchDocs = createServerFn({ method: 'GET' })
  .validator(
    z.object({ repo: z.string(), branch: z.string(), filePath: z.string() })
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const file = await fetchRepoFile(repo, branch, filePath)

    if (!file) {
      throw notFound()
      // if (currentPath === redirectPath) {
      //   // console.log('not found')
      //   throw notFound()
      // } else {
      //   // console.log('redirect')
      //   throw redirect({
      //     to: redirectPath,
      //   })
      // }
    }

    const frontMatter = extractFrontMatter(file)
    const description = removeMarkdown(frontMatter.excerpt ?? '')

    // Cache for 5 minutes on shared cache
    // Revalidate in the background
    setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setHeader(
      'CDN-Cache-Control',
      'max-age=300, stale-while-revalidate=300, durable'
    )

    return {
      title: frontMatter.data?.title,
      description,
      filePath,
      content: frontMatter.content,
    }
  })

export const fetchFile = createServerFn({ method: 'GET' })
  .validator(
    z.object({ repo: z.string(), branch: z.string(), filePath: z.string() })
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const file = await fetchRepoFile(repo, branch, filePath)

    if (!file) {
      throw notFound()
    }

    // Cache for 60 minutes on shared cache
    // Revalidate in the background
    setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setHeader(
      'CDN-Cache-Control',
      'max-age=3600, stale-while-revalidate=3600, durable'
    )

    return file
  })

export const fetchRepoDirectoryContents = createServerFn({
  method: 'GET',
})
  .validator(
    z.object({
      repo: z.string(),
      branch: z.string(),
      startingPath: z.string(),
    })
  )
  .handler(async ({ data: { repo, branch, startingPath } }) => {
    const githubContents = await fetchApiContents(repo, branch, startingPath)

    // Cache for 60 minutes on shared cache
    // Revalidate in the background
    setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setHeader(
      'CDN-Cache-Control',
      'max-age=3600, stale-while-revalidate=3600, durable'
    )

    return githubContents
  })

// GitHub contribution stats server functions - commented out due to performance/accuracy concerns
/*
export const fetchContributorStats = createServerFn({ method: 'GET' })
  .validator(z.object({ username: z.string() }))
  .handler(async ({ data: { username } }) => {
    const stats = await getContributorStats(username)

    // Cache for 30 minutes on shared cache
    // Revalidate in the background
    setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setHeader(
      'CDN-Cache-Control',
      'max-age=1800, stale-while-revalidate=1800, durable'
    )

    return stats
  })

export const fetchContributorStatsForLibrary = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      username: z.string(),
      libraryRepo: z.string(),
    })
  )
  .handler(async ({ data: { username, libraryRepo } }) => {
    const stats = await getContributorStatsForLibrary(username, libraryRepo)

    // Cache for 30 minutes on shared cache
    // Revalidate in the background
    setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setHeader(
      'CDN-Cache-Control',
      'max-age=1800, stale-while-revalidate=1800, durable'
    )

    return stats
  })

export const fetchBatchContributorStats = createServerFn({ method: 'GET' })
  .validator(z.object({ usernames: z.array(z.string()) }))
  .handler(async ({ data: { usernames } }) => {
    const stats = await getBatchContributorStats(usernames)

    // Cache for 30 minutes on shared cache
    // Revalidate in the background
    setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setHeader(
      'CDN-Cache-Control',
      'max-age=1800, stale-while-revalidate=1800, durable'
    )

    return stats
  })

// Helper function to get stats for all maintainers
export const fetchAllMaintainerStats = createServerFn({
  method: 'GET',
}).handler(async () => {
  try {
    // Import maintainers data
    const { allMaintainers } = await import('~/libraries/maintainers')

    const usernames = allMaintainers.map((maintainer) => maintainer.github)
    const stats = await getBatchContributorStats(usernames)

    // Cache for 30 minutes on shared cache
    // Revalidate in the background
    setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setHeader(
      'CDN-Cache-Control',
      'max-age=1800, stale-while-revalidate=1800, durable'
    )

    return stats
  } catch (error) {
    console.error('Error fetching all maintainer stats:', error)
    // Return empty array if there's an error
    return []
  }
})
*/

// Helper function to check if the Accept header prefers markdown
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false

  const accepts = acceptHeader.split(',').map(type => {
    const [mediaType, ...params] = type.trim().split(';')
    const quality = params.find(p => p.trim().startsWith('q='))
    const q = quality ? parseFloat(quality.split('=')[1]) : 1.0
    return { mediaType: mediaType.toLowerCase(), q }
  })

  const markdownQ = accepts.find(a =>
    a.mediaType === 'text/markdown' || a.mediaType === 'text/plain'
  )?.q || 0

  const htmlQ = accepts.find(a =>
    a.mediaType === 'text/html' || a.mediaType === '*/*'
  )?.q || 0

  return markdownQ > 0 && markdownQ > htmlQ
}

// Helper function to create markdown response
export function createMarkdownResponse(
  title: string,
  content: string
): Response {
  const markdownContent = `# ${title}\n${content}`

  return new Response(markdownContent, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Cdn-Cache-Control': 'max-age=300, stale-while-revalidate=300, durable',
      'Vary': 'Accept',
    },
  })
}
