import {
  extractFrontMatter,
  fetchApiContents,
  fetchRepoFile,
} from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import * as v from 'valibot'
import { setResponseHeader } from '~/utils/headers.server'
import { renderMarkdownToJsx } from '~/utils/markdown'
import { DocContent } from '~/components/markdown/DocContent'

export const loadDocs = async ({
  repo,
  branch,
  docsPath,
}: {
  repo: string
  branch: string
  docsPath: string
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
    },
  })
}

export const fetchDocs = createServerFn({ method: 'GET' })
  .inputValidator(
    v.object({ repo: v.string(), branch: v.string(), filePath: v.string() }),
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const file = await fetchRepoFile(repo, branch, filePath)

    if (!file) {
      throw notFound()
    }

    const frontMatter = extractFrontMatter(file)
    const description = removeMarkdown(frontMatter.excerpt ?? '')

    // Render markdown directly to JSX on the server
    const { content, headings } = await renderMarkdownToJsx(frontMatter.content)

    // Wrap in RSC stream for client hydration
    const contentRsc = await renderServerComponent(
      <DocContent>{content}</DocContent>,
    )

    // Cache for 5 minutes on shared cache
    // Revalidate in the background
    setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setResponseHeader(
      'CDN-Cache-Control',
      'max-age=300, stale-while-revalidate=300, durable',
    )

    return {
      title: frontMatter.data?.title,
      description,
      filePath,
      content: frontMatter.content, // Raw markdown content for .md routes
      contentRsc,
      headings,
      frontmatter: frontMatter.data,
    }
  })

export const fetchFile = createServerFn({ method: 'GET' })
  .inputValidator(
    v.object({ repo: v.string(), branch: v.string(), filePath: v.string() }),
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const file = await fetchRepoFile(repo, branch, filePath)

    if (!file) {
      throw notFound()
    }

    // Cache for 60 minutes on shared cache
    // Revalidate in the background
    setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setResponseHeader(
      'CDN-Cache-Control',
      'max-age=3600, stale-while-revalidate=3600, durable',
    )

    return file
  })

export const fetchRepoDirectoryContents = createServerFn({
  method: 'GET',
})
  .inputValidator(
    v.object({
      repo: v.string(),
      branch: v.string(),
      startingPath: v.string(),
    }),
  )
  .handler(async ({ data: { repo, branch, startingPath } }) => {
    const githubContents = await fetchApiContents(repo, branch, startingPath)

    if (!githubContents) {
      throw notFound()
    }

    // Cache for 60 minutes on shared cache
    // Revalidate in the background
    setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    setResponseHeader(
      'CDN-Cache-Control',
      'max-age=3600, stale-while-revalidate=3600, durable',
    )

    return githubContents
  })
