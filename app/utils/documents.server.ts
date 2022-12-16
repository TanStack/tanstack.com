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

async function fetchRemote(owner: string, repo: string, ref: string, filepath: string) {
  const href = new URL(`${owner}/${repo}/${ref}/${filepath}`, 'https://raw.githubusercontent.com/').href
  console.log('fetching file', href)
  
  const response = await fetch(href, {
    headers: { 'User-Agent': `docs:${owner}/${repo}` },
  })

  if (!response.ok) {
    return null;
  }

  return await response.text()
}

export async function fetchRepoFile(
  repoPair: string,
  ref: string,
  filepath: string
) {
  const key = `${repoPair}:${ref}:${filepath}`
  let [owner, repo] = repoPair.split('/')

  const file = await fetchCached({
    key,
    ttl: 1 * 60 * 1000, // 5 minute
    fn: async () => {
      const maxDepth = 4;
      let currentDepth = 1;
      while (maxDepth > currentDepth) {
        let text: string | null;
        if (process.env.NODE_ENV === 'development') {
          const localFilePath = path.resolve(__dirname, `../../${repo}`, filepath)

          console.log('local path', __dirname, filepath, localFilePath)
          const file = await fsp.readFile(localFilePath)
          text = file.toString()
        } else {
          text = await fetchRemote(owner, repo, ref, filepath);
        }
        
        if (text === null) {
          return null;
        }
        try {
          const frontmatter = extractFrontMatter(text)
          if (!frontmatter.data.ref) return Promise.resolve(text)
          filepath = frontmatter.data.ref
        } catch (error) {
          return Promise.resolve(text)
        }
        currentDepth++;
      }

      return null
    },
  })

  return file
}

export async function markdownToMdx(content: string) {
  const [{ default: rehypeSlug }, { default: remarkGfm }] =
    // @ts-ignore
    await Promise.all([import('rehype-slug'), import('remark-gfm')])

  const mdx = await bundleMDX<{ title: string }>({
    source: content,
    mdxOptions: (options) => {
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkGfm]
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
