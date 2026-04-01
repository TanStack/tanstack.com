import { defineCollection, defineConfig } from '@content-collections/core'
import { z } from 'zod'

const posts = defineCollection({
  name: 'posts',
  directory: './src/blog',
  include: '*.md',
  schema: z.object({
    title: z.string(),
    published: z.iso.date(),
    draft: z.boolean().optional(),
    excerpt: z.string(),
    authors: z.string().array(),
  }),
  transform: ({ content, ...post }) => {
    // Extract header image (first image after frontmatter)
    const headerImageMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    const headerImage = headerImageMatch ? headerImageMatch[2] : undefined

    return {
      ...post,
      slug: post._meta.path,
      headerImage,
      content,
    }
  },
})

export default defineConfig({
  collections: [posts],
})
