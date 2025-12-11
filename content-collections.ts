import { defineCollection, defineConfig } from '@content-collections/core'
import { extractFrontMatter } from '~/utils/documents.server'

const posts = defineCollection({
  name: 'posts',
  directory: './src/blog',
  include: '*.md',
  schema: (z) => ({
    title: z.string(),
    published: z.string().date(),
    authors: z.string().array(),
  }),
  transform: ({ content, ...post }) => {
    const frontMatter = extractFrontMatter(content)

    // Extract header image (first image after frontmatter)
    const headerImageMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    const headerImage = headerImageMatch ? headerImageMatch[2] : undefined

    return {
      ...post,
      slug: post._meta.path,
      excerpt: frontMatter.excerpt,
      description: frontMatter.data.description,
      headerImage,
      content,
    }
  },
})

export default defineConfig({
  collections: [posts],
})
