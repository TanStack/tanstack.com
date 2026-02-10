// Server function for rendering blog content as RSC
// This file is separate from the route to ensure proper bundler processing
// of the server component and client component imports.

import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { renderMarkdownToJsx } from '~/utils/markdown'
import { BlogContent } from '~/components/markdown/BlogContent'

export const renderBlogContent = createServerFn({ method: 'GET' })
  .inputValidator((content: string) => content)
  .handler(async ({ data: content }) => {
    const { content: jsxContent } = await renderMarkdownToJsx(content)
    return renderServerComponent(<BlogContent>{jsxContent}</BlogContent>)
  })
