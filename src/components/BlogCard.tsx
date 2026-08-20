import { Link } from '@tanstack/react-router'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { Card } from '~/components/Card'
import { CoverFallback } from '~/components/CoverFallback'
import {
  formatAuthors,
  formatPublishedDate,
  getBlogLibraries,
  type BlogCardPost,
} from '~/utils/blog-format'
import { getOptimizedImageUrl } from '~/utils/optimizedImage'

export type { BlogCardPost } from '~/utils/blog-format'

type BlogCardProps = {
  post: BlogCardPost
  showLibraryBadges?: boolean
}

export function BlogCard({ post, showLibraryBadges = true }: BlogCardProps) {
  const {
    slug,
    title,
    published,
    excerpt,
    headerImage,
    authors,
    library,
    externalUrl,
    source,
  } = post
  const blogLibraries = showLibraryBadges ? getBlogLibraries(library) : []
  const cardClassName = twMerge(
    'relative flex flex-col justify-between overflow-hidden transition-all hover:shadow-sm hover:border-blue-500',
  )
  const mediaClassName = twMerge(
    'aspect-video w-full overflow-hidden bg-background-subtle',
  )

  const content = (
    <>
      {blogLibraries.length ? (
        <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-1">
          {blogLibraries.map((blogLibrary) => (
            <div
              key={blogLibrary.id}
              className={`rounded-md px-2 py-1 text-xs font-black uppercase shadow-sm ${blogLibrary.bgStyle} ${blogLibrary.badgeTextStyle ?? 'text-white'}`}
            >
              {blogLibrary.name.replace('TanStack ', '')}
            </div>
          ))}
        </div>
      ) : null}
      {headerImage ? (
        <div className={mediaClassName}>
          <img
            src={getOptimizedImageUrl(headerImage, {
              fit: 'cover',
              format: 'auto',
              quality: 80,
              width: 800,
            })}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <CoverFallback
          slug={slug}
          library={library}
          className={mediaClassName}
        />
      )}
      <div className="p-4 md:p-8 flex flex-col gap-4 flex-1 justify-between">
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          <div className="text-xs italic font-light mt-1">
            by {formatAuthors(authors)}
            {published ? (
              <time dateTime={published} title={formatPublishedDate(published)}>
                {' '}
                on {formatPublishedDate(published)}
              </time>
            ) : null}
          </div>
          {excerpt ? (
            <p className="text-sm mt-4 text-text-secondary leading-7 line-clamp-2">
              {excerpt}
            </p>
          ) : null}
        </div>
        <div>
          {externalUrl ? (
            <div className="inline-flex items-center gap-1 text-blue-500 uppercase font-black text-sm">
              Read on {source ?? 'Source'}
              <ArrowSquareOutIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          ) : (
            <div className="text-blue-500 uppercase font-black text-sm">
              Read More
            </div>
          )}
        </div>
      </div>
    </>
  )

  if (externalUrl) {
    return (
      <Card
        as="a"
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
      >
        {content}
      </Card>
    )
  }

  return (
    <Card
      as={Link}
      to="/blog/$"
      params={{ _splat: slug } as never}
      className={cardClassName}
    >
      {content}
    </Card>
  )
}
