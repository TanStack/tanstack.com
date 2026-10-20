import type { BlogAuthorIdentity } from '~/utils/blog-format'
import { formatAuthors } from '~/utils/blog-format'
import {
  getTanStackOrganizationJsonLd,
  TANSTACK_ORGANIZATION_ID,
} from '~/utils/organization-structured-data'
import { getAbsoluteOptimizedImageUrl } from '~/utils/optimizedImage'
import { canonicalUrl, seo } from '~/utils/seo'

export type BlogPostHeadData = {
  authorIdentities: Array<BlogAuthorIdentity>
  authors: Array<string>
  description: string
  isUnpublished: boolean
  published: string
  slug: string
  socialImage?: string
  title: string
  updated?: string
}

export function getBlogSocialImageUrl(headerImage: string | undefined) {
  if (!headerImage) {
    return undefined
  }

  if (headerImage.startsWith('http')) {
    return headerImage
  }

  return getAbsoluteOptimizedImageUrl(headerImage, {
    fit: 'cover',
    format: 'auto',
    height: 630,
    quality: 80,
    width: 1200,
  })
}

export function getBlogPostingJsonLd(post: BlogPostHeadData) {
  const pageUrl = canonicalUrl(`/blog/${post.slug}`)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      getTanStackOrganizationJsonLd(),
      {
        '@type': 'BlogPosting' as const,
        '@id': `${pageUrl}#blog-post`,
        headline: post.title,
        description: post.description,
        url: pageUrl,
        mainEntityOfPage: {
          '@type': 'WebPage' as const,
          '@id': pageUrl,
        },
        ...(post.socialImage ? { image: post.socialImage } : {}),
        datePublished: post.published,
        ...(post.updated ? { dateModified: post.updated } : {}),
        author: post.authorIdentities.map((author) =>
          author.type === 'Organization' && author.name === 'TanStack'
            ? { '@id': TANSTACK_ORGANIZATION_ID }
            : {
                '@type': author.type,
                name: author.name,
                ...(author.url ? { url: author.url } : {}),
              },
        ),
        publisher: {
          '@id': TANSTACK_ORGANIZATION_ID,
        },
      },
    ],
  }
}

export function getBlogPostHead(post: BlogPostHeadData | undefined) {
  if (!post) {
    return { meta: [], scripts: [] }
  }

  return {
    meta: [
      ...seo({
        title: `${post.title} | TanStack Blog`,
        description: post.description,
        image: post.socialImage,
        noindex: post.isUnpublished,
        ogType: 'article',
        articlePublishedTime: post.published,
        articleModifiedTime: post.updated,
      }),
      {
        name: 'author',
        content: `${
          post.authors.length > 1 ? 'co-authored by ' : ''
        }${formatAuthors(post.authors)}`,
      },
    ],
    scripts: post.isUnpublished
      ? []
      : [
          {
            type: 'application/ld+json',
            children: JSON.stringify(getBlogPostingJsonLd(post)),
          },
        ],
  }
}
