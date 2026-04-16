import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import * as graymatter from 'gray-matter'
import { fetchCached } from '~/utils/cache.server'
import {
  getCachedGitHubJsonContent,
  getCachedGitHubTextFile,
} from './github-content-cache.server'
import { normalizeRedirectFrom } from './redirects'
import { multiSortBy, removeLeadingSlash } from './utils'
import { env } from './env'

export type GitHubContentErrorKind =
  | 'forbidden'
  | 'invalid-response'
  | 'network'
  | 'rate-limit'
  | 'server'

export class GitHubContentError extends Error {
  kind: GitHubContentErrorKind
  status?: number

  constructor(
    kind: GitHubContentErrorKind,
    message: string,
    opts?: { cause?: unknown; status?: number },
  ) {
    super(message, { cause: opts?.cause })
    this.name = 'GitHubContentError'
    this.kind = kind
    this.status = opts?.status
  }
}

export function isRecoverableGitHubContentError(
  error: unknown,
): error is GitHubContentError {
  return (
    error instanceof GitHubContentError &&
    ['forbidden', 'network', 'rate-limit', 'server'].includes(error.kind)
  )
}

function shouldUseLocalDocsFiles() {
  if (process.env.NODE_ENV !== 'development') {
    return false
  }

  return !['1', 'true', 'yes'].includes(
    process.env.TANSTACK_DOCS_USE_REMOTE?.toLowerCase() ?? '',
  )
}

/**
 * Return text content of file from remote location
 */
async function fetchRemote(
  owner: string,
  repo: string,
  ref: string,
  filepath: string,
) {
  const href = new URL(
    `${owner}/${repo}/${ref}/${filepath}`,
    'https://raw.githubusercontent.com/',
  ).href

  let response: Response

  try {
    response = await fetch(href, {
      headers: { 'User-Agent': `docs:${owner}/${repo}` },
    })
  } catch (error) {
    throw new GitHubContentError(
      'network',
      `Failed to fetch ${repo}@${ref}:${filepath}`,
      { cause: error },
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }

    if (response.status === 403 || response.status === 429) {
      throw new GitHubContentError(
        'rate-limit',
        `GitHub rate limited ${repo}@${ref}:${filepath}`,
        { status: response.status },
      )
    }

    if (response.status >= 500) {
      throw new GitHubContentError(
        'server',
        `GitHub failed to serve ${repo}@${ref}:${filepath}`,
        { status: response.status },
      )
    }

    throw new GitHubContentError(
      'forbidden',
      `GitHub rejected ${repo}@${ref}:${filepath}`,
      { status: response.status },
    )
  }

  return await response.text()
}

/**
 * Validate that a filepath doesn't attempt path traversal
 */
function isValidFilepath(filepath: string): boolean {
  const normalized = path.normalize(filepath)
  return (
    !normalized.startsWith('..') &&
    !normalized.includes('/../') &&
    !path.isAbsolute(normalized)
  )
}

/**
 * Return text content of file from local file system
 */
async function fetchFs(repo: string, filepath: string) {
  if (!isValidFilepath(filepath)) {
    console.warn(`[fetchFs] Invalid filepath rejected: ${filepath}\n`)
    return ''
  }

  const dirname = import.meta.url.split('://').at(-1)!
  const baseDir = path.resolve(dirname, `../../../../${repo}`)
  const localFilePath = path.resolve(baseDir, filepath)

  if (!localFilePath.startsWith(baseDir)) {
    console.warn(
      `[fetchFs] Path traversal attempt blocked: ${filepath} resolved to ${localFilePath}\n`,
    )
    return ''
  }

  const exists = fs.existsSync(localFilePath)
  if (!exists) {
    console.warn(
      `[fetchFs] Tried to read file that does not exist: ${localFilePath}\n`,
    )
    return ''
  }
  const file = await fsp.readFile(localFilePath)
  return file.toString()
}

/**
 * Perform global string replace in text for given key-value map
 */
function replaceContent(
  text: string,
  frontmatter: graymatter.GrayMatterFile<string>,
) {
  let result = text
  const replace = frontmatter.data.replace as Record<string, string> | undefined
  if (replace) {
    Object.entries(replace).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value)
    })
  }

  return result
}

/**
 * Perform tokenized sections replace in text.
 * - Discover sections based on token marker via RegExp in origin file.
 * - Discover sections based on token marker via RegExp in target file.
 * - replace sections in target file staring from the end, with sections defined in origin file
 * @param text File content
 * @param frontmatter Referencing file front-matter
 * @returns File content with replaced sections
 */
function replaceSections(
  text: string,
  frontmatter: graymatter.GrayMatterFile<string>,
) {
  let result = text
  // RegExp defining token pair to dicover sections in the document
  // [//]: # (<Section Token>)
  const sectionMarkerRegex = /\[\/\/\]: # '([a-zA-Z\d]*)'/g
  const sectionRegex =
    /\[\/\/\]: # '([a-zA-Z\d]*)'[\S\s]*?\[\/\/\]: # '([a-zA-Z\d]*)'/g

  // Find all sections in origin file
  const substitutes = new Map<string, RegExpMatchArray>()
  for (const match of frontmatter.content.matchAll(sectionRegex)) {
    if (match[1] !== match[2]) {
      console.error(
        `Origin section '${match[1]}' does not have matching closing token (found '${match[2]}'). Please make sure that each section has corresponsing closing token and that sections are not nested.`,
      )
    }

    substitutes.set(match[1], match)
  }

  // Find all sections in target file
  const sections = new Map<string, RegExpMatchArray>()
  for (const match of result.matchAll(sectionRegex)) {
    if (match[1] !== match[2]) {
      console.error(
        `Target section '${match[1]}' does not have matching closing token (found '${match[2]}'). Please make sure that each section has corresponsing closing token and that sections are not nested.`,
      )
    }

    sections.set(match[1], match)
  }

  Array.from(substitutes.entries())
    .reverse()
    .forEach(([key, value]) => {
      const sectionMatch = sections.get(key)
      if (sectionMatch) {
        result =
          result.slice(0, sectionMatch.index!) +
          value[0] +
          result.slice(
            sectionMatch.index! + sectionMatch[0].length,
            result.length,
          )
      }
    })

  // Remove all section markers from the result
  result = result.replaceAll(sectionMarkerRegex, '')

  return result
}

/**
 * Perform image src replacement in text for given repo pair and ref.
 * - Find all instances of markdown inline images
 * - Find all instances of markdown html images
 * - Replace image src's for given repo pair and ref if matched
 * @param text Markdown file content
 * @param repoPair Repo pair e.g. "TanStack/router"
 * @param ref Branch ref e.g. "main"
 * @returns Markdown file content with replaced image src's for given repo pair and ref
 */
function replaceProjectImageBranch(
  text: string,
  repoPair: string,
  ref: string,
) {
  const handleReplaceImageSrc = (src: string): string => {
    const srcLowered = src.toLowerCase()
    const isHttps = srcLowered.startsWith('https://')

    const testOrigin = isHttps
      ? 'https://raw.githubusercontent.com/'
      : 'http://raw.githubusercontent.com/'

    let validSrcOrigin: string | undefined

    if (srcLowered.startsWith(testOrigin)) {
      validSrcOrigin = testOrigin
    }

    // If the image src does not start with a known origin, return the src as is
    if (!validSrcOrigin) {
      return src
    }

    // If the image src does not contain the repo pair after the origin, return the src as is
    const repoIndex = srcLowered.indexOf(repoPair.toLowerCase())
    if (
      repoIndex === -1 ||
      src.indexOf(validSrcOrigin) + validSrcOrigin.length !== repoIndex
    ) {
      return src
    }

    // If the branch ref is the same as the target ref, return the src as is
    const refIndex = srcLowered.indexOf(ref.toLowerCase())
    if (refIndex !== -1 && refIndex === repoIndex + repoPair.length + 1) {
      return src
    }

    // We should only replace the branch ref if it is present and only immediately after the repo pair
    // It should NOT be replaced if it is further down the path.

    // Example: If the ref is "main" and the src is "https://github.com/TanStack/router/beta/docs/assets/beta.png"
    // then the replaced src should be "https://github.com/TanStack/router/main/docs/assets/beta.png"

    const branchIndex = repoIndex + repoPair.length + 1
    const nextSlashIndex = src.indexOf('/', branchIndex)
    const oldRef = src.slice(branchIndex, nextSlashIndex)
    const newSrc = src.replace(oldRef, ref)
    return newSrc
  }

  // find all instances of markdown inline images
  const markdownInlineImageRegex = /!(\[([^\]]+)]\(([^)]+)\))/g
  const inlineMarkdownImageMatches = text.matchAll(markdownInlineImageRegex)
  for (const match of inlineMarkdownImageMatches) {
    const [fullMatch, _, __, src] = match
    const newSrc = handleReplaceImageSrc(src)

    // No need to replace the src if it is the same as the original
    if (newSrc === src) {
      continue
    }

    const replacement = fullMatch.replace(src, newSrc)
    text = text.replace(fullMatch, replacement)
  }

  // find all instances of markdown html images
  const markdownImageHtmlTagRegex = /<img[^>]+>/g
  const htmlImageTagMatches = text.matchAll(markdownImageHtmlTagRegex)
  for (const match of htmlImageTagMatches) {
    const [fullMatch] = match

    // Match the src attribute on the img tag
    // The src could be wrapped with single or double quotes
    const src =
      fullMatch.match(/src='([^']+)'/)?.[1] ||
      fullMatch.match(/src="([^"]+)"/)?.[1]

    if (!src) {
      continue
    }

    const newSrc = handleReplaceImageSrc(src)

    // No need to replace the src if it is the same as the original
    if (newSrc === src) {
      continue
    }

    const replacement = fullMatch.replace(src, newSrc)
    text = text.replace(fullMatch, replacement)
  }

  return text
}

async function fetchRepoFileFromOrigin(
  repoPair: string,
  ref: string,
  filepath: string,
) {
  const [owner, repo] = repoPair.split('/')
  const maxDepth = 4
  let currentDepth = 1
  let originFrontmatter: graymatter.GrayMatterFile<string> | undefined

  while (maxDepth > currentDepth) {
    let text: string | null

    if (shouldUseLocalDocsFiles()) {
      text = await fetchFs(repo, filepath)
    } else {
      text = await fetchRemote(owner, repo, ref, filepath)
    }

    if (text === null) {
      return null
    }

    try {
      const frontmatter = extractFrontMatter(text)

      if (!frontmatter.data.ref) {
        if (originFrontmatter) {
          text = replaceContent(text, originFrontmatter)
          text = replaceSections(text, originFrontmatter)
        }

        return replaceProjectImageBranch(text, repoPair, ref)
      }

      filepath = frontmatter.data.ref
      originFrontmatter = frontmatter
    } catch {
      return text
    }

    currentDepth++
  }

  return null
}

export async function fetchRepoFile(
  repoPair: string,
  ref: string,
  filepath: string,
) {
  const key = `${repoPair}:${ref}:${filepath}`

  if (shouldUseLocalDocsFiles()) {
    return fetchCached({
      key,
      ttl: 1,
      fn: () => fetchRepoFileFromOrigin(repoPair, ref, filepath),
    })
  }

  return getCachedGitHubTextFile({
    repo: repoPair,
    gitRef: ref,
    path: filepath,
    origin: () => fetchRepoFileFromOrigin(repoPair, ref, filepath),
  })
}

export function extractFrontMatter(content: string) {
  const result = graymatter.default(content, {
    excerpt: (file: any) => (file.excerpt = createRichExcerpt(file.content)),
  })
  const redirectFrom = normalizeRedirectFrom(result.data.redirect_from)

  return {
    ...result,
    data: {
      ...result.data,
      description: createExcerpt(result.content),
      redirect_from: redirectFrom,
      redirectFrom,
    } as { [key: string]: any } & {
      description: string
      redirect_from?: Array<string>
      redirectFrom?: Array<string>
    },
  }
}

function createExcerpt(text: string, maxLength = 200) {
  // Remove Markdown formatting using a basic regex

  let cleanText = text
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
    .replace(/[`*_~>]/g, '') // Remove Markdown special characters
    .replace(/#+\s/g, '') // Remove headers
    .replace(/-\s/g, '') // Remove list markers
    .replace(/\r?\n|\r/g, ' ') // Convert line breaks to spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()

  // Truncate the text to the desired length, preserving whole words
  if (cleanText.length > maxLength) {
    cleanText = cleanText.slice(0, maxLength).trim() + '...'
  }

  return cleanText
}

function createRichExcerpt(text: string, maxLength = 200) {
  let cleanText = createExcerpt(text, maxLength)

  const imageText = extractFirstImage(text)

  if (imageText) {
    cleanText = `${imageText}<div style="height:1rem;"></div>${cleanText}`
  }

  return cleanText
}

function extractFirstImage(markdown: string) {
  // Regex to match Markdown image syntax: ![alt text](url)
  const imageRegex = /!\[(.*?)\]\((.*?)\)/
  const match = markdown.match(imageRegex)
  return match?.[0]
}

export interface GitHubFile {
  name: string
  path: string
  // sha: string
  // size: number
  // url: string
  // html_url: string
  // git_url: string
  // download_url: string
  type: string
  _links: {
    self: string
    // git: string
    // html: string
  }
}

export interface GitHubFileNode extends GitHubFile {
  children?: Array<GitHubFileNode>
  depth: number
  parentPath?: string
}

interface GitHubBranchResponse {
  commit: {
    sha: string
  }
}

interface GitHubTreeEntry {
  path: string
  sha: string
  size?: number
  type: 'blob' | 'tree'
  url: string
}

interface GitHubRecursiveTreeResponse {
  tree: Array<GitHubTreeEntry>
  truncated?: boolean
}

function isGitHubFileNode(value: unknown): value is GitHubFileNode {
  const candidate = value as {
    _links?: { self?: unknown }
    children?: unknown
    depth?: unknown
    name?: unknown
    path?: unknown
    type?: unknown
  } | null

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof candidate?.name === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.depth === 'number' &&
    typeof candidate._links === 'object' &&
    candidate._links !== null &&
    typeof candidate._links.self === 'string' &&
    (!('children' in value) ||
      candidate.children === undefined ||
      (Array.isArray(candidate.children) &&
        candidate.children.every((child) => isGitHubFileNode(child))))
  )
}

function isGitHubFileNodeArray(value: unknown): value is Array<GitHubFileNode> {
  return Array.isArray(value) && value.every((item) => isGitHubFileNode(item))
}

function isGitHubBranchResponse(value: unknown): value is GitHubBranchResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    commit?: { sha?: unknown }
  }

  return typeof candidate.commit?.sha === 'string'
}

function isGitHubTreeEntry(value: unknown): value is GitHubTreeEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    path?: unknown
    sha?: unknown
    size?: unknown
    type?: unknown
    url?: unknown
  }

  return (
    typeof candidate.path === 'string' &&
    typeof candidate.sha === 'string' &&
    (candidate.size === undefined || typeof candidate.size === 'number') &&
    (candidate.type === 'blob' || candidate.type === 'tree') &&
    typeof candidate.url === 'string'
  )
}

function isGitHubRecursiveTreeResponse(
  value: unknown,
): value is GitHubRecursiveTreeResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    tree?: unknown
    truncated?: unknown
  }

  return (
    Array.isArray(candidate.tree) &&
    candidate.tree.every((entry) => isGitHubTreeEntry(entry)) &&
    (candidate.truncated === undefined ||
      typeof candidate.truncated === 'boolean')
  )
}

function getGitHubApiFetchOptions(): RequestInit {
  return {
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
    },
  }
}

async function fetchGitHubApiJson(url: string) {
  let response: Response

  try {
    response = await fetch(url, getGitHubApiFetchOptions())
  } catch (error) {
    throw new GitHubContentError(
      'network',
      `Failed to fetch GitHub API: ${url}`,
      {
        cause: error,
      },
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }

    if (response.status === 403 || response.status === 429) {
      throw new GitHubContentError('rate-limit', `GitHub rate limited ${url}`, {
        status: response.status,
      })
    }

    if (response.status >= 500) {
      throw new GitHubContentError('server', `GitHub failed to serve ${url}`, {
        status: response.status,
      })
    }

    throw new GitHubContentError('forbidden', `GitHub rejected ${url}`, {
      status: response.status,
    })
  }

  try {
    return (await response.json()) as unknown
  } catch (error) {
    throw new GitHubContentError(
      'invalid-response',
      `Invalid GitHub JSON for ${url}`,
      {
        cause: error,
      },
    )
  }
}

async function fetchGitHubBranchSha(repo: string, branch: string) {
  const data = await getCachedGitHubJsonContent({
    repo,
    gitRef: branch,
    path: '__github_branch__',
    isValue: isGitHubBranchResponse,
    origin: async () => {
      const url = `https://api.github.com/repos/${repo}/branches/${branch}`
      const response = await fetchGitHubApiJson(url)

      if (response === null) {
        return null
      }

      if (!isGitHubBranchResponse(response)) {
        throw new GitHubContentError(
          'invalid-response',
          `Unexpected branch response for ${repo}@${branch}`,
        )
      }

      return response
    },
  })

  return data?.commit.sha ?? null
}

export async function fetchGitHubRecursiveTree(repo: string, branch: string) {
  const branchSha = await fetchGitHubBranchSha(repo, branch)

  if (!branchSha) {
    return null
  }

  const data = await getCachedGitHubJsonContent({
    repo,
    gitRef: branch,
    path: '__github_recursive_tree__',
    isValue: isGitHubRecursiveTreeResponse,
    origin: async () => {
      const url = `https://api.github.com/repos/${repo}/git/trees/${branchSha}?recursive=1`
      const response = await fetchGitHubApiJson(url)

      if (response === null) {
        return null
      }

      if (!isGitHubRecursiveTreeResponse(response)) {
        throw new GitHubContentError(
          'invalid-response',
          `Unexpected recursive tree response for ${repo}@${branch}`,
        )
      }

      return response
    },
  })

  return data?.tree ?? null
}

function buildFileTreeFromRecursiveTree(
  tree: Array<GitHubTreeEntry>,
  startingPath: string,
): Array<GitHubFileNode> | null {
  const normalizedStart = removeLeadingSlash(startingPath).replace(/\/+$/g, '')
  const prefix = normalizedStart ? `${normalizedStart}/` : ''
  const scopedEntries = tree.filter(
    (entry) =>
      entry.path === normalizedStart ||
      (prefix !== '' && entry.path.startsWith(prefix)) ||
      (prefix === '' && entry.path.length > 0),
  )

  const hasStartingPath =
    normalizedStart === '' ||
    scopedEntries.some(
      (entry) =>
        entry.path === normalizedStart || entry.path.startsWith(prefix),
    )

  if (!hasStartingPath) {
    return null
  }

  const childrenByParent = new Map<string, Array<GitHubTreeEntry>>()

  for (const entry of scopedEntries) {
    if (entry.path === normalizedStart) {
      continue
    }

    const parentPath = entry.path.split('/').slice(0, -1).join('/')
    const siblings = childrenByParent.get(parentPath) ?? []
    siblings.push(entry)
    childrenByParent.set(parentPath, siblings)
  }

  const buildChildren = (
    parentPath: string,
    depth: number,
    parentPrefix: string,
  ) => {
    return sortApiContents(
      (childrenByParent.get(parentPath) ?? []).map((entry) => ({
        name: entry.path.split('/').at(-1) ?? entry.path,
        path: entry.path,
        type: entry.type === 'tree' ? 'dir' : 'file',
        _links: { self: entry.path },
      })),
    ).map((entry) => {
      const node: GitHubFileNode = {
        ...entry,
        depth,
        parentPath: parentPrefix,
      }

      if (entry.type === 'dir') {
        node.children = buildChildren(
          entry.path,
          depth + 1,
          `${parentPrefix}${entry.path}/`,
        )
      }

      return node
    })
  }

  return buildChildren(normalizedStart, 0, '')
}

const API_CONTENTS_MAX_DEPTH = 3

export function fetchApiContents(
  repoPair: string,
  branch: string,
  startingPath: string,
) {
  if (shouldUseLocalDocsFiles()) {
    return fetchCached({
      key: `${repoPair}:${branch}:${startingPath}`,
      ttl: 1,
      fn: () => fetchApiContentsFs(repoPair, startingPath),
    })
  }

  return getCachedGitHubJsonContent({
    repo: repoPair,
    gitRef: branch,
    path: startingPath,
    isValue: isGitHubFileNodeArray,
    origin: () => fetchApiContentsRemote(repoPair, branch, startingPath),
  })
}

function sortApiContents(contents: Array<GitHubFile>): Array<GitHubFile> {
  return multiSortBy(contents, [
    (node) => (node.type === 'dir' ? -1 : 1),
    (node) => (node.name.startsWith('.') ? -1 : 1),
    (node) => node.name,
  ])
}

async function fetchApiContentsFs(
  repoPair: string,
  startingPath: string,
): Promise<Array<GitHubFileNode> | null> {
  const [_, repo] = repoPair.split('/')
  const dirname = import.meta.url.split('://').at(-1)!

  const base = path.resolve(dirname, `../../../../${repo}`)
  const fsStartPath = path.join(base, removeLeadingSlash(startingPath))

  const dirsAndFilesToIgnore = [
    'node_modules',
    '.git',
    'dist',
    'test-results',
    '.output',
    '.netlify',
    '.vercel',
    '.DS_Store',
    '.nitro',
    '.tanstack-start/build',
  ]

  async function getContentsForPath(
    filePath: string,
  ): Promise<Array<GitHubFile>> {
    try {
      const list = await fsp.readdir(filePath, { withFileTypes: true })
      return list
        .filter((item) => !dirsAndFilesToIgnore.includes(item.name))
        .map((item) => {
          return {
            name: item.name,
            path: path.join(filePath, item.name),
            type: item.isDirectory() ? 'dir' : 'file',
            _links: {
              self: path.join(filePath, item.name),
            },
          }
        })
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return []
      }
      throw error
    }
  }

  const data = await getContentsForPath(fsStartPath)

  if (data.length === 0) {
    return null
  }

  async function buildFileTree(
    nodes: Array<GitHubFile> | undefined,
    depth: number,
    parentPath: string,
  ) {
    const result: Array<GitHubFileNode> = []

    const sortedNodes = sortApiContents(nodes ?? [])

    for (const node of sortedNodes) {
      const file: GitHubFileNode = {
        ...node,
        depth,
        parentPath,
      }

      if (file.type === 'dir' && depth <= API_CONTENTS_MAX_DEPTH) {
        const directoryFiles = await getContentsForPath(file._links.self)
        file.children = await buildFileTree(
          directoryFiles,
          depth + 1,
          `${parentPath}${file.path}/`,
        )
      }

      // This replacement is only being done to more accurately mock the GitHub API response
      file.path = removeLeadingSlash(file.path.replace(base, ''))
      file._links.self = removeLeadingSlash(file._links.self.replace(base, ''))

      result.push(file)
    }

    return result
  }

  const fileTree = await buildFileTree(data, 0, '')
  return fileTree
}

async function fetchApiContentsRemote(
  repo: string,
  branch: string,
  startingPath: string,
): Promise<Array<GitHubFileNode> | null> {
  const tree = await fetchGitHubRecursiveTree(repo, branch)

  if (!tree) {
    return null
  }

  return buildFileTreeFromRecursiveTree(tree, startingPath)
}
