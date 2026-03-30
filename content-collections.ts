import { defineCollection, defineConfig } from '@content-collections/core'
import { normalizeRedirectFrom } from '~/utils/documents.server'

const posts = defineCollection({
  name: 'posts',
  directory: './src/blog',
  include: '*.md',
  schema: (z) => ({
    title: z.string(),
    published: z.string().date(),
    draft: z.boolean().optional(),
    excerpt: z.string(),
    authors: z.string().array(),
    redirect_from: z.string().array().optional(),
  }),
  transform: ({ content, ...post }) => {
    // Extract header image (first image after frontmatter)
    const headerImageMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    const headerImage = headerImageMatch ? headerImageMatch[2] : undefined
    const redirectFrom = normalizeRedirectFrom(post.redirect_from)

    return {
      ...post,
      slug: post._meta.path,
      headerImage,
      redirect_from: redirectFrom,
      redirectFrom,
      content,
    }
  },
})

export default defineConfig({
  collections: [posts],
})
