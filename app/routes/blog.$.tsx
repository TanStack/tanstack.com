import { createFileRoute, notFound } from '@tanstack/react-router'
import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-router-server'

const fetchBlogPost = createServerFn(
  'GET',
  async ({ docsPath }: { docsPath: string }, req) => {
    'use server'

    if (!docsPath) {
      throw new Error('Invalid docs path')
    }

    const filePath = `app/blog/${docsPath}.md`

    const file = await fetchRepoFile('tanstack/tanstack.com', 'main', filePath)

    if (!file) {
      throw notFound()
    }

    const frontMatter = extractFrontMatter(file)
    const description = removeMarkdown(frontMatter.excerpt ?? '')

    return {
      title: frontMatter.data.title,
      description,
      published: frontMatter.data.published,
      content: frontMatter.content,
      filePath,
    }
  }
)

export const Route = createFileRoute('/blog/$')({
  loader: ({ params }) => fetchBlogPost({ docsPath: params._splat }),
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title ?? 'Docs'} | TanStack Blog`,
      description: loaderData?.description,
    }),
  notFoundComponent: () => <PostNotFound />,
  component: BlogPost,
})

export default function BlogPost() {
  const { title, content, filePath } = Route.useLoaderData()

  return (
    <Doc
      title={title}
      content={content}
      repo={'tanstack/tanstack.com'}
      branch={'main'}
      filePath={filePath}
    />
  )
}
