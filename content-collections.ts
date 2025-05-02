import { defineCollection, defineConfig } from '@content-collections/core'
import { extractFrontMatter } from '~/utils/documents.server'

const posts = defineCollection({
  name: 'posts',
  directory: 'app/blog',
  include: '**/*.md',
  transform: ({ content, ...rest }) => {
    return {
      ...rest,
      ...extractFrontMatter(content),
    }
  },
  schema: (z) => ({
    title: z.string(),
    published: z.string().date(),
    authors: z.string().array(),
  }),
})

export default defineConfig({
  collections: [posts],
})
