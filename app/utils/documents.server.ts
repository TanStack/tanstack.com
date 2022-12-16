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
    return null
  }

  return await response.text()
}

async function fetchFs(repo: string, filepath: string) {
  const localFilePath = path.resolve(__dirname, `../../${repo}`, filepath)

  console.log('local path', __dirname, filepath, localFilePath)
  const file = await fsp.readFile(localFilePath)
  return file.toString()
}

function replaceContent(text: string, frontmatter: graymatter.GrayMatterFile<string>) {
  let result = text
  const replace = frontmatter.data.replace as Record<string, string> | undefined
  if (replace) {
    Object.entries(replace).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value)
    })
  }

  return result
}

function replaceSections(text: string, frontmatter: graymatter.GrayMatterFile<string>) {
  let result = text
  const sectionRegex = /\[\/\/\]: # \(([a-zA-Z]*)\)[\S\s]*?\[\/\/\]: # \(([a-zA-Z]*)\)/g

  const substitutes = new Map<string, RegExpMatchArray>()
  for (const match of frontmatter.content.matchAll(sectionRegex)) {
    substitutes.set(match[1], match)
  }

  if (substitutes.size > 0) {
    const sections = new Map<string, RegExpMatchArray>()
    for (const match of result.matchAll(sectionRegex)) {
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
            result.slice(sectionMatch.index! + sectionMatch[0].length, result.length)
        }
      })
  }

  return result
}

export async function fetchRepoFile(repoPair: string, ref: string, filepath: string) {
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
        if (process.env.NODE_ENV === 'development') {
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
            return Promise.resolve(text)
          }
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
    excerpt: (file: any) => (file.excerpt = file.content.split('\n').slice(0, 4).join('\n')),
  })
}
