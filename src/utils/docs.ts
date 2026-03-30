import {
  extractFrontMatter,
  fetchApiContents,
  fetchRepoFile,
} from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import { setResponseHeader } from '@tanstack/react-start/server'
import { fetchCached } from './cache.server'
import { removeLeadingSlash } from './utils'

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
      content: frontMatter.content,
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

type DocsTreeNode = {
  path: string
  children?: Array<DocsTreeNode>
}

export async function resolveDocsRedirect(opts: {
  repo: string
  branch: string
  docsRoot: string
  docsPaths: Array<string>
}) {
  const manifest = await getDocsRedirectManifest(opts)

  for (const docsPath of opts.docsPaths) {
    const normalizedDocsPath = normalizeDocsRedirectPath(docsPath)

    if (!normalizedDocsPath) {
      continue
    }

    const redirectedPath = manifest[normalizedDocsPath]

    if (redirectedPath) {
      return redirectedPath
    }
  }

  return null
}

async function getDocsRedirectManifest(opts: {
  repo: string
  branch: string
  docsRoot: string
}) {
  const { repo, branch, docsRoot } = opts

  return fetchCached<Record<string, string>>({
    key: `docs-redirects:${repo}:${branch}:${docsRoot}`,
    ttl: process.env.NODE_ENV === 'production' ? 1000 * 60 * 10 : 1,
    fn: async () => {
      const nodes = await fetchApiContents(repo, branch, docsRoot)

      if (!nodes) {
        return {}
      }

      const markdownFiles = flattenDocsNodes(nodes).filter((node) =>
        node.path.endsWith('.md'),
      )

      const entries = await Promise.all(
        markdownFiles.map(async (node) => {
          const canonicalPath = getCanonicalDocsPath(node.path, docsRoot)

          if (canonicalPath === null) {
            return [] as Array<readonly [string, string]>
          }

          const file = await fetchRepoFile(repo, branch, node.path)

          if (!file) {
            return [] as Array<readonly [string, string]>
          }

          const frontMatter = extractFrontMatter(file)

          return (frontMatter.data.redirectFrom ?? [])
            .map((redirectFrom) => normalizeDocsRedirectPath(redirectFrom))
            .flatMap((redirectFrom) => {
              if (!redirectFrom || redirectFrom === canonicalPath) {
                return []
              }

              return [[redirectFrom, canonicalPath] as const]
            })
        }),
      )

      return Object.fromEntries(entries.flat())
    },
  })
}

function flattenDocsNodes(nodes: Array<DocsTreeNode>): Array<DocsTreeNode> {
  return nodes.flatMap((node) => [
    node,
    ...flattenDocsNodes(node.children ?? []),
  ])
}

function getCanonicalDocsPath(filePath: string, docsRoot: string) {
  const normalizedFilePath = removeLeadingSlash(filePath)
  const normalizedDocsRoot = removeLeadingSlash(docsRoot)
  const docsRootPrefix = `${normalizedDocsRoot}/`

  if (!normalizedFilePath.startsWith(docsRootPrefix)) {
    return null
  }

  const relativePath = normalizedFilePath
    .slice(docsRootPrefix.length)
    .replace(/\.md$/, '')
    .replace(/\/index$/, '')

  return relativePath
}

function normalizeDocsRedirectPath(path: string) {
  const normalizedPath = removeLeadingSlash(path.trim()).replace(/\/+$/, '')

  return normalizedPath || null
}
