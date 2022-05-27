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
    ttl: process.env.NODE_ENV === 'production' ? 1 : 1000000,
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
  repoPair: string,
  ref: string,
  filepath: string,
  isLocal?: boolean
) {
  const key = `${repoPair}:${ref}:${path}`
  const file = await fetchCached(key, async () => {
    let [owner, repo] = repoPair.split('/')
    if (isLocal) {
      const localFilePath = path.join(__dirname, '../../../../..', filepath)
      const file = await fsp.readFile(localFilePath)
      return file.toString()
    }

    let filePath = `${owner}/${repo}/${ref}/${filepath}`
    const href = new URL(`/${filePath}`, 'https://raw.githubusercontent.com/')
      .href

    console.log('Fetching:', href)

    let response = await fetch(href, {
      headers: { 'User-Agent': `docs:${owner}/${repo}` },
    })

    if (!response.ok) return null

    return response.text()
  })

  return file
}

export async function markdownToMdx(content: string) {
  const { default: rehypeSlug } =
    // @ts-ignore
    await import('rehype-slug')

  const mdx = await bundleMDX<{ title: string }>({
    source: content,
    mdxOptions: (options) => {
      // options.remarkPlugins = [...(options.remarkPlugins ?? []), rehypeSlug]
      options.rehypePlugins = [...(options.rehypePlugins ?? []), rehypeSlug]
      return options
    },
  })

  return mdx
}

export function extractFrontMatter(content: string) {
  return graymatter.default(content, {
    excerpt: (file: any) =>
      (file.excerpt = file.content.split('\n').slice(0, 4).join('\n')),
  })
}
