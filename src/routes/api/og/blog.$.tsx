import { createFileRoute, notFound } from '@tanstack/react-router'
import { ImageResponse, ImageResponseOptions } from '@takumi-rs/image-response'
import { BlogImage } from '~/components/og/BlogImage'
import { allPosts } from 'content-collections'

function handleRedirects(docsPath: string) {
  if (docsPath.includes('directives-the-new-framework-lock-in')) {
    return 'directives-and-the-platform-boundary'
  }

  return docsPath
}

export const Route = createFileRoute('/api/og/blog/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!params._splat) {
          throw notFound()
        }

        const slug = handleRedirects(params._splat)

        const post = allPosts.find((post) => post.slug === slug)

        if (!post) {
          throw notFound()
        }

        return new ImageResponse(<BlogImage {...post} />, {
          width: 1200,
          height: 630,
          format: 'webp',
          headers: {
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Netlify-CDN-Cache-Control':
              'public, max-age=300, durable, stale-while-revalidate=300',
          },
        })
      },
    },
  },
})
