// Server function for rendering blog content as RSC
// This file is separate from the route to ensure proper bundler processing
// of the server component and client component imports.

import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { renderMarkdownToJsx } from '~/utils/markdown'
import { BlogContent } from '~/components/markdown/BlogContent'
import { setCacheHeaders } from '~/utils/headers.server'
import { allPosts } from 'content-collections'
import { formatAuthors } from '~/utils/blog'
import { format } from '~/utils/dates'
import { notFound } from '@tanstack/react-router'
import * as v from 'valibot'

export const loadBlogPost = createServerFn({ method: 'GET' })
  .inputValidator(v.object({ slug: v.string() }))
  .handler(async ({ data: { slug } }) => {
    const post = allPosts.find((p) => p.slug === slug)

    if (!post) {
      throw notFound()
    }

    setCacheHeaders()

    const now = new Date()
    const publishDate = new Date(post.published)
    const isUnpublished = post.draft || publishDate > now

    const blogContent = `<small>_by ${formatAuthors(post.authors)} on ${format(
      new Date(post.published || 0),
      'MMMM d, yyyy',
    )}._</small>

${post.content}`

    const { content: jsxContent, headings } =
      await renderMarkdownToJsx(blogContent)
    const ContentRsc = await renderServerComponent(
      <BlogContent>{jsxContent}</BlogContent>,
    )

    return {
      title: post.title,
      description: post.description,
      published: post.published,
      authors: post.authors,
      headerImage: post.headerImage,
      filePath: `src/blog/${slug}.md`,
      isUnpublished,
      headings,
      ContentRsc,
    }
  })
