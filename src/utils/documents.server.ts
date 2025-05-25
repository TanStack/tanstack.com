import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
// import { fileURLToPath } from 'node:url'
import * as graymatter from 'gray-matter'
import { fetchCached } from '~/utils/cache.server'
import { multiSortBy, removeLeadingSlash } from './utils'
import { env } from './env'

export type Doc = {
  filepath: string
}

export type DocFrontMatter = {
  title: string
  published?: string
  exerpt?: string
}

/**
 * Return text content of file from remote location
 */
async function fetchRemote(
  owner: string,
  repo: string,
  ref: string,
  filepath: string
) {
  const href = new URL(
    `${owner}/${repo}/${ref}/${filepath}`,
    'https://raw.githubusercontent.com/'
  ).href

  const response = await fetch(href, {
    headers: { 'User-Agent': `docs:${owner}/${repo}` },
  })

  if (!response.ok) {
    return null
  }

  return await response.text()
}

/**
 * Return text content of file from local file system
 */
async function fetchFs(repo: string, filepath: string) {
  // const __dirname = fileURLToPath(new URL('.', import.meta.url))
  const dirname = import.meta.url.split('://').at(-1)!
  const localFilePath = path.resolve(dirname, `../../../../${repo}`, filepath)
  const exists = fs.existsSync(localFilePath)
  if (!exists) {
    console.warn(
      `[fetchFs] Tried to read file that does not exist: ${localFilePath}\n`
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
  frontmatter: graymatter.GrayMatterFile<string>
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
  frontmatter: graymatter.GrayMatterFile<string>
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
        `Origin section '${match[1]}' does not have matching closing token (found '${match[2]}'). Please make sure that each section has corresponsing closing token and that sections are not nested.`
      )
    }

    substitutes.set(match[1], match)
  }

  // Find all sections in target file
  const sections = new Map<string, RegExpMatchArray>()
  for (const match of result.matchAll(sectionRegex)) {
    if (match[1] !== match[2]) {
      console.error(
        `Target section '${match[1]}' does not have matching closing token (found '${match[2]}'). Please make sure that each section has corresponsing closing token and that sections are not nested.`
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
            result.length
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
  ref: string
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
  const markdownInlineImageRegex = /\!(\[([^\]]+)\]\(([^)]+)\))/g
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

export async function fetchRepoFile(
  repoPair: string,
  ref: string,
  filepath: string
) {
  const key = `${repoPair}:${ref}:${filepath}`
  let [owner, repo] = repoPair.split('/')

  const ttl = process.env.NODE_ENV === 'development' ? 1 : 1 * 60 * 1000 // 5 minute
  const file = await fetchCached({
    key,
    ttl,
    fn: async () => {
      const maxDepth = 4
      let currentDepth = 1
      let originFrontmatter: graymatter.GrayMatterFile<string> | undefined
      while (maxDepth > currentDepth) {
        let text: string | null
        // Read file contents
        try {
          if (process.env.NODE_ENV === 'development') {
            text = await fetchFs(repo, filepath)
          } else {
            text = await fetchRemote(owner, repo, ref, filepath)
          }
        } catch (err) {
          console.error(err)
          return null
        }

        if (text === null) {
          return null
        }
        try {
          const frontmatter = extractFrontMatter(text)
          // If file does not have a ref in front-matter, replace necessary content
          if (!frontmatter.data.ref) {
            if (originFrontmatter) {
              text = replaceContent(text, originFrontmatter)
              text = replaceSections(text, originFrontmatter)
            }
            text = replaceProjectImageBranch(text, repoPair, ref)
            return Promise.resolve(text)
          }
          // If file has a ref to another file, cache current front-matter and load referenced file
          filepath = frontmatter.data.ref
          originFrontmatter = frontmatter
        } catch (error) {
          return Promise.resolve(text)
        }
        currentDepth++
      }

      return null
    },
  })

  return file
}

export function extractFrontMatter(content: string) {
  const result = graymatter.default(content, {
    excerpt: (file: any) => (file.excerpt = createRichExcerpt(file.content)),
  })

  return {
    ...result,
    data: {
      ...result.data,
      description: createExcerpt(result.content),
    } as { [key: string]: any } & { description: string },
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

const API_CONTENTS_MAX_DEPTH = 3

export function fetchApiContents(
  repoPair: string,
  branch: string,
  startingPath: string
) {
  const isDev = process.env.NODE_ENV === 'development'
  return fetchCached({
    key: `${repoPair}:${branch}:${startingPath}`,
    ttl: isDev ? 1 : 1 * 60 * 1000, // 5 minute
    fn: () => {
      return isDev
        ? fetchApiContentsFs(repoPair, startingPath)
        : fetchApiContentsRemote(repoPair, branch, startingPath)
    },
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
  startingPath: string
): Promise<Array<GitHubFileNode> | null> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    '.vinxi',
    '.tanstack-start/build',
  ]

  async function getContentsForPath(
    filePath: string
  ): Promise<Array<GitHubFile>> {
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
  }

  const data = await getContentsForPath(fsStartPath)

  async function buildFileTree(
    nodes: Array<GitHubFile> | undefined,
    depth: number,
    parentPath: string
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
          `${parentPath}${file.path}/`
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
  startingPath: string
): Promise<Array<GitHubFileNode> | null> {
  const fetchOptions: RequestInit = {
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
    },
  }
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${startingPath}?ref=${branch}`,
    fetchOptions
  )

  if (!res.ok) {
    throw new Error(
      `Failed to fetch repo contents for ${repo}/${branch}/${startingPath}: Status is ${res.statusText} - ${res.status}`
    )
  }

  const data = (await res.json()) as Array<GitHubFile> | null

  if (!Array.isArray(data)) {
    console.warn(
      'Expected an array of files from GitHub API, but received:\n',
      JSON.stringify(data)
    )
    return null
  }

  async function buildFileTree(
    nodes: Array<GitHubFile> | undefined,
    depth: number,
    parentPath: string
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
        const directoryFilesResponse = await fetch(
          file._links.self,
          fetchOptions
        )
        const directoryFiles =
          (await directoryFilesResponse.json()) as Array<GitHubFile>

        file.children = await buildFileTree(
          directoryFiles,
          depth + 1,
          `${parentPath}${file.path}/`
        )
      }

      result.push(file)
    }

    return result
  }

  const fileTree = await buildFileTree(data, 0, '')
  return fileTree
}
