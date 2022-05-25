import fsp from 'fs/promises'
import LRUCache from 'lru-cache'
import path from 'path'
import { bundleMDX } from 'mdx-bundler'
import * as graymatter from 'gray-matter'
import { useContext } from 'react'

type BundledMDX = Awaited<ReturnType<typeof bundleMDX>>

export type Doc = {
  filepath: string
  mdx: Omit<BundledMDX, 'frontmatter'> & {
    frontmatter: DocFrontMatter
  }
}

export type DocFrontMatter = {
  title: string
  published?: string
  exerpt?: string
}

declare global {
  var docCache: LRUCache<string, unknown>
}

let docCache =
  global.docCache ||
  (global.docCache = new LRUCache<string, unknown>({
    max: 300,
    ttl: process.env.NODE_ENV === 'production' ? 1 : 1,
  }))

export async function fetchCached<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (docCache.has(key)) {
    return docCache.get(key) as T
  }

  const result = await fn()
  docCache.set(key, result)

  return result
}

export async function fetchRepoFile(
  repo: string,
  ref: string,
  filepath: string,
  isLocal?: boolean
) {
  const key = `${repo}:${ref}:${path}`
  const file = await fetchCached(key, async () =>
    _fetchRepoContent(repo, ref, filepath, isLocal)
  )

  return file
}

export async function fetchRepoMarkdown(
  repo: string,
  ref: string,
  filepath: string,
  isLocal?: boolean
): Promise<undefined | Doc> {
  const key = `${repo}:${ref}:${filepath}`
  return fetchCached(key, async () => {
    const file = await _fetchRepoContent(repo, ref, filepath, isLocal)

    if (!file) {
      return undefined
    }

    const { default: rehypeSlug } =
      // @ts-ignore
      await import('rehype-slug')

    const mdx = await bundleMDX<{ title: string }>({
      source: file,
      mdxOptions: (options, frontmatter) => {
        // options.remarkPlugins = [...(options.remarkPlugins ?? []), rehypeSlug]
        options.rehypePlugins = [...(options.rehypePlugins ?? []), rehypeSlug]

        return options
      },
    })

    if (mdx.frontmatter.title === undefined) {
      const title = path.basename(filepath, '.md')
      mdx.frontmatter.title = title
    }

    return { filepath, mdx }
  })
}

export async function fetchRepoFrontMatter(
  repo: string,
  ref: string,
  filepath: string,
  isLocal?: boolean
): Promise<undefined | DocFrontMatter> {
  const key = `${repo}:${ref}:${filepath}`
  return fetchCached(key, async () => {
    const file = await _fetchRepoContent(repo, ref, filepath, isLocal)

    if (!file) {
      return undefined
    }

    const matter = graymatter.default(file, {
      excerpt: (file: any) =>
        (file.excerpt = file.content.split('\n').slice(0, 4).join('\n')),
    })

    const data = matter.data

    if (data.title === undefined) {
      const title = path.basename(filepath, '.md')
      data.title = title
    }

    console.log(matter)

    return { ...data, exerpt: matter.excerpt } as DocFrontMatter
  })
}

async function _fetchRepoContent(
  repoPair: string,
  ref: string,
  filepath: string,
  isLocal?: boolean
): Promise<string | null> {
  let [owner, repo] = repoPair.split('/')
  if (isLocal) {
    const localFilePath = path.join(__dirname, '../../../../..', filepath)
    const file = await fsp.readFile(localFilePath)
    return file.toString()
  }

  let filePath = `${owner}/${repo}/${ref}/${filepath}`
  const href = new URL(`/${filePath}`, 'https://raw.githubusercontent.com/')
    .href

  let response = await fetch(href, {
    headers: { 'User-Agent': `docs:${owner}/${repo}` },
  })

  if (!response.ok) return null

  return response.text()
}
