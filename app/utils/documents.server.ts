import fsp from 'fs/promises'

import path from 'path'
import { bundleMDX } from 'mdx-bundler'
import * as graymatter from 'gray-matter'
import { fetchCached } from './cache.server'

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

export async function fetchRepoFile(
  repoPair: string,
  ref: string,
  filepath: string,
  isLocal?: boolean
) {
  const key = `${repoPair}:${ref}:${filepath}`
  const file = await fetchCached({
    key,
    ttl: 1 * 60 * 1000, // 5 minute
    fn: async () => {
      let [owner, repo] = repoPair.split('/')
      if (isLocal) {
        const localFilePath = path.resolve(__dirname, '..', filepath)
        const file = await fsp.readFile(localFilePath)
        return file.toString()
      }

      let filePath = `${owner}/${repo}/${ref}/${filepath}`
      const href = new URL(`/${filePath}`, 'https://raw.githubusercontent.com/')
        .href

      console.log('fetching', href)

      let response = await fetch(href, {
        headers: { 'User-Agent': `docs:${owner}/${repo}` },
      })

      if (!response.ok) return null

      return response.text()
    },
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
