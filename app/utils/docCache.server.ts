import LRUCache from 'lru-cache'
import path from 'path'
import { bundleMDX } from 'mdx-bundler'

type BundledMDX = Awaited<ReturnType<typeof bundleMDX>>

export type Doc = {
  filepath: string
  mdx: Omit<BundledMDX, 'frontmatter'> & { frontmatter: { title: string } }
}

declare global {
  var docCache: LRUCache<string, unknown>
}

let docCache =
  global.docCache ||
  (global.docCache = new LRUCache<string, unknown>({
    max: 300,
    ttl: process.env.NODE_ENV === 'production' ? 1 : 300000,
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
  filepath: string
) {
  const key = `${repo}:${ref}:${path}`
  const file = await fetchCached(key, async () =>
    getRepoContent(repo, ref, filepath)
  )

  return file
}

export async function fetchRepoMarkdown(
  repo: string,
  ref: string,
  filepath: string
): Promise<undefined | Doc> {
  const key = `${repo}:${ref}:${filepath}`
  return fetchCached(key, async () => {
    const file = await getRepoContent(repo, ref, filepath)
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

async function getRepoContent(
  repoPair: string,
  ref: string,
  filepath: string
): Promise<string | null> {
  let [owner, repo] = repoPair.split('/')
  let filePath = `${owner}/${repo}/${ref}/${filepath}`
  const href = new URL(`/${filePath}`, 'https://raw.githubusercontent.com/')
    .href
  console.log(href)
  let response = await fetch(href, {
    headers: { 'User-Agent': `docs:${owner}/${repo}` },
  })
  if (!response.ok) return null
  return response.text()
}
