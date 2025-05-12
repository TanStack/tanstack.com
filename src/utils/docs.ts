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
  if (!branch) {
    throw new Error('Invalid branch')
  }

  if (!docsPath) {
    throw new Error('Invalid docPath')
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
