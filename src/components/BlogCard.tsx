import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { Card } from '~/components/Card'
import { CoverFallback } from '~/components/CoverFallback'
import {
  formatAuthors,
  formatPublishedDate,
  getBlogLibraries,
  type BlogCardPost,
} from '~/utils/blog'
import { getNetlifyImageUrl } from '~/utils/netlifyImage'

export type { BlogCardPost } from '~/utils/blog'

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
  const cardClassName =
    'relative flex flex-col justify-between overflow-hidden transition-all hover:shadow-sm hover:border-blue-500'

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
        <div className="aspect-video overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={getNetlifyImageUrl(headerImage)}
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
          className="aspect-video w-full"
        />
      )}
      <div className="p-4 md:p-8 flex flex-col gap-4 flex-1 justify-between">
        <div>
          <div className="text-lg font-extrabold">{title}</div>
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
            <p className="text-sm mt-4 text-gray-600 dark:text-gray-400 leading-7 line-clamp-4">
              {excerpt}
            </p>
          ) : null}
        </div>
        <div>
          {externalUrl ? (
            <div className="inline-flex items-center gap-1 text-blue-500 uppercase font-black text-sm">
              Read on {source ?? 'Source'}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
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
