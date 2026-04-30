import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import removeMarkdown from 'remove-markdown'
import * as v from 'valibot'
import {
  extractFrontMatter,
  fetchApiContents,
  fetchRepoFile,
  isRecoverableGitHubContentError,
} from '~/utils/documents.server'
import { renderMarkdownToRsc } from './markdown'
import { extractFrameworksFromMarkdown } from './markdown/filterFrameworkContent'
import { getCachedDocsArtifact } from './github-content-cache.server'
import { buildRedirectManifest, type RedirectManifestEntry } from './redirects'
import { removeLeadingSlash } from './utils'

type DocsTreeNode = {
  path: string
  children?: Array<DocsTreeNode>
}

type DocsManifest = {
  paths: Array<string>
  redirects: Record<string, string>
}

type RepoFileRequest = {
  repo: string
  branch: string
  filePath: string
}

type RepoDirectoryRequest = {
  repo: string
  branch: string
  startingPath: string
}

const repoFileInput = v.object({
  repo: v.string(),
  branch: v.string(),
  filePath: v.string(),
})

const repoDirectoryInput = v.object({
  repo: v.string(),
  branch: v.string(),
  startingPath: v.string(),
})

const docsManifestInput = v.object({
  repo: v.string(),
  branch: v.string(),
  docsRoot: v.string(),
})

const docsRedirectInput = v.object({
  repo: v.string(),
  branch: v.string(),
  docsRoot: v.string(),
  docsPaths: v.array(v.string()),
})

const temporarilyUnavailableMarkdown = `# Content temporarily unavailable

We are having trouble fetching this document from GitHub right now. Please try again in a minute.`

function buildUnavailableFile(filePath: string) {
  if (filePath.toLowerCase().endsWith('.md')) {
    return temporarilyUnavailableMarkdown
  }

  return 'Content temporarily unavailable. Please try again in a minute.'
}

async function readRepoFileOrFallback(
  repo: string,
  branch: string,
  filePath: string,
) {
  try {
    return await fetchRepoFile(repo, branch, filePath)
  } catch (error) {
    if (!isRecoverableGitHubContentError(error)) {
      throw error
    }

    return buildUnavailableFile(filePath)
  }
}

function setDocsCacheHeaders(cdnCacheControl: string) {
  setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
  setResponseHeader('CDN-Cache-Control', cdnCacheControl)
}

function isDocsManifest(value: unknown): value is DocsManifest {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    paths?: unknown
    redirects?: unknown
  }

  return (
    Array.isArray(candidate.paths) &&
    candidate.paths.every((path) => typeof path === 'string') &&
    typeof candidate.redirects === 'object' &&
    candidate.redirects !== null &&
    Object.entries(candidate.redirects).every(
      ([key, target]) => typeof key === 'string' && typeof target === 'string',
    )
  )
}

export const fetchDocsManifest = createServerFn({ method: 'GET' })
  .inputValidator(docsManifestInput)
  .handler(async ({ data }) => {
    const { repo, branch, docsRoot } = data

    return getCachedDocsArtifact({
      repo,
      gitRef: branch,
      docsRoot,
      artifactType: 'docs-manifest',
      artifactKey: 'default',
      isValue: isDocsManifest,
      build: async () => {
        const nodes = await fetchApiContents(repo, branch, docsRoot)

        if (!nodes) {
          return { paths: [], redirects: {} }
        }

        const markdownFiles = flattenDocsNodes(nodes).filter((node) =>
          node.path.endsWith('.md'),
        )
        const paths = new Set<string>()
        const redirects: Array<RedirectManifestEntry> = []

        for (const node of markdownFiles) {
          const canonicalPath = getCanonicalDocsPath(node.path, docsRoot)

          if (canonicalPath === null) {
            continue
          }

          paths.add(canonicalPath)

          const file = await fetchRepoFile(repo, branch, node.path)

          if (!file) {
            continue
          }

          const frontMatter = extractFrontMatter(file)

          for (const redirectFrom of frontMatter.data.redirectFrom ?? []) {
            const normalizedRedirect = normalizeDocsRedirectPath(
              redirectFrom,
              docsRoot,
            )

            if (!normalizedRedirect || normalizedRedirect === canonicalPath) {
              continue
            }

            redirects.push({
              from: normalizedRedirect,
              to: canonicalPath,
              source: node.path,
            })
          }
        }

        return {
          paths: Array.from(paths),
          redirects: buildRedirectManifest(redirects, {
            label: `docs redirects for ${repo}@${branch}:${docsRoot}`,
          }),
        }
      },
    })
  })

export const fetchDocsRedirect = createServerFn({ method: 'GET' })
  .inputValidator(docsRedirectInput)
  .handler(async ({ data }) => {
    const manifest = await fetchDocsManifest({
      data: {
        repo: data.repo,
        branch: data.branch,
        docsRoot: data.docsRoot,
      },
    })

    for (const docsPath of data.docsPaths) {
      const normalizedDocsPath = normalizeDocsRedirectPath(
        docsPath,
        data.docsRoot,
      )

      if (!normalizedDocsPath) {
        continue
      }

      const redirectedPath = manifest.redirects[normalizedDocsPath]

      if (redirectedPath !== undefined) {
        return redirectedPath
      }
    }

    return null
  })

export const fetchDocs = createServerFn({ method: 'GET' })
  .inputValidator(repoFileInput)
  .handler(async ({ data }: { data: RepoFileRequest }) => {
    const { repo, branch, filePath } = data
    const file = await readRepoFileOrFallback(repo, branch, filePath)

    if (!file) {
      throw notFound()
    }

    const frontMatter = extractFrontMatter(file)
    const description = removeMarkdown(frontMatter.excerpt ?? '')
    const { contentRsc, headings } = await renderMarkdownToRsc(
      frontMatter.content,
    )

    setDocsCacheHeaders('max-age=300, stale-while-revalidate=300, durable')

    return {
      content: frontMatter.content,
      contentRsc,
      title: frontMatter.data?.title ?? 'Content temporarily unavailable',
      description,
      frameworks: extractFrameworksFromMarkdown(frontMatter.content),
      filePath,
      headings,
      frontmatter: frontMatter.data,
    }
  })

export const fetchDocsPage = createServerFn({ method: 'GET' })
  .inputValidator(repoFileInput)
  .handler(async ({ data }: { data: RepoFileRequest }) => {
    const doc = await fetchDocs({ data })

    return {
      contentRsc: doc.contentRsc,
      description: doc.description,
      filePath: doc.filePath,
      frontmatter: doc.frontmatter,
      frameworks: doc.frameworks,
      headings: doc.headings,
      title: doc.title,
    }
  })

export const fetchFile = createServerFn({ method: 'GET' })
  .inputValidator(repoFileInput)
  .handler(async ({ data }: { data: RepoFileRequest }) => {
    const { repo, branch, filePath } = data
    const file = await readRepoFileOrFallback(repo, branch, filePath)

    if (!file) {
      throw notFound()
    }

    setDocsCacheHeaders('max-age=3600, stale-while-revalidate=3600, durable')

    return file
  })

export const fetchRepoDirectoryContents = createServerFn({
  method: 'GET',
})
  .inputValidator(repoDirectoryInput)
  .handler(async ({ data }: { data: RepoDirectoryRequest }) => {
    const { repo, branch, startingPath } = data
    const githubContents = await fetchApiContents(repo, branch, startingPath)

    if (!githubContents) {
      throw notFound()
    }

    setDocsCacheHeaders('max-age=3600, stale-while-revalidate=3600, durable')

    return githubContents
  })

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

  return normalizedFilePath
    .slice(docsRootPrefix.length)
    .replace(/\.md$/, '')
    .replace(/\/index$/, '')
}

function normalizeDocsRedirectPath(path: string, docsRoot?: string) {
  const normalizedPath = removeLeadingSlash(path.trim()).replace(/\/+$/g, '')

  if (!normalizedPath) {
    return null
  }

  const docsRootPrefix = getDocsRootPrefix(docsRoot)

  if (docsRootPrefix && normalizedPath.startsWith(`${docsRootPrefix}/`)) {
    return normalizedPath.slice(docsRootPrefix.length + 1) || ''
  }

  return normalizedPath
}

function getDocsRootPrefix(docsRoot?: string) {
  if (!docsRoot) {
    return null
  }

  const normalizedDocsRoot = removeLeadingSlash(docsRoot).replace(/\/+$/g, '')

  if (!normalizedDocsRoot.startsWith('docs/')) {
    return null
  }

  return normalizedDocsRoot.slice('docs/'.length) || null
}
