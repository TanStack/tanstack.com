import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { CoverFallback } from '~/components/CoverFallback'
import {
  formatAuthors,
  formatPublishedDate,
  getBlogLibraries,
} from '~/utils/blog-format'
import type { RecentPost } from '~/utils/blog.functions'
import { getOptimizedImageUrl } from '~/utils/optimizedImage'

// The card renders library tags when the post carries a `library`; `RecentPost`
// (nav / homepage) omits it, so those usages stay tag-free.
type BlogPostCardPost = RecentPost & { library?: string }

export function BlogPostCard({
  className,
  onNavigate,
  post,
  size = 'sm',
  featured = false,
}: {
  className?: string
  onNavigate?: () => void
  post: BlogPostCardPost
  /** `lg` is the roomier grid treatment on the Blog index; `sm` (default) is the
   *  compact card used in the nav mega-menu and homepage. */
  size?: 'sm' | 'lg'
  /** Hero treatment: image and copy sit side-by-side on wider screens with the
   *  largest type. Used for the single latest post atop the Blog index. */
  featured?: boolean
}) {
  const isLarge = featured || size === 'lg'
  const blogLibraries = getBlogLibraries(post.library)

  const cardClassName = twMerge(
    'group/post flex flex-col rounded-xl corner-squircle transition-colors hover:bg-surface-state-hover focus-visible:bg-surface-state-hover focus-visible:outline-none',
    featured
      ? 'gap-4 p-4 md:flex-row md:gap-6'
      : isLarge
        ? 'gap-4 p-4'
        : 'gap-3 p-3',
    className,
  )

  const content = (
    <>
      <div
        className={twMerge(
          'relative aspect-video w-full overflow-hidden rounded-lg corner-squircle border border-border-subtle bg-background-subtle',
          featured && 'md:aspect-auto md:w-1/2',
        )}
      >
        {post.headerImage ? (
          <img
            src={getOptimizedImageUrl(post.headerImage, {
              fit: 'cover',
              format: 'auto',
              quality: 80,
              width: featured ? 1200 : isLarge ? 900 : 640,
            })}
            alt=""
            loading={featured ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <CoverFallback
            slug={post.slug}
            library={post.library}
            className="h-full w-full"
          />
        )}
        {blogLibraries.length ? (
          <div className="pointer-events-none absolute right-2 top-2 flex flex-wrap justify-end gap-1">
            {blogLibraries.map((library) => (
              <span
                key={library.id}
                className={twMerge(
                  'rounded-md px-1.5 py-0.5 font-ds-mono text-ds-mono-caps-xs uppercase',
                  library.bgStyle,
                  library.badgeTextStyle ?? 'text-white',
                )}
              >
                {library.name.replace('TanStack ', '')}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div
        className={twMerge(
          'flex flex-col px-1 pb-1',
          isLarge ? 'gap-1.5' : 'gap-1',
          featured && 'md:w-1/2 md:justify-center md:px-2',
        )}
      >
        {/* Plain strings (not twMerge): the DS `text-ds-*` size utilities and the
            `text-*` color utilities both start with `text-`, and twMerge would
            drop the color. */}
        <div
          className={`font-ds-display text-text-primary ${
            featured
              ? 'line-clamp-3 text-ds-heading-2'
              : isLarge
                ? 'line-clamp-2 text-ds-heading-3'
                : 'line-clamp-1 text-ds-heading-5'
          }`}
        >
          {post.title}
        </div>
        <p
          className={`text-text-secondary ${
            featured
              ? 'line-clamp-3 text-ds-body-md'
              : isLarge
                ? 'line-clamp-3 text-ds-body-sm'
                : 'line-clamp-2 text-ds-body-xs'
          }`}
        >
          {post.excerpt}
        </p>
        <div
          className={`mt-0.5 font-ds-mono text-text-muted/70 ${isLarge ? 'text-ds-mono-sm' : 'text-ds-mono-xs'}`}
        >
          {formatAuthors(post.authors)} · {formatPublishedDate(post.published)}
        </div>
      </div>
    </>
  )

  if (post.externalUrl) {
    return (
      <a
        href={post.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={cardClassName}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      to="/blog/$"
      params={{ _splat: post.slug } as never}
      onClick={onNavigate}
      preload="intent"
      activeProps={{ className: 'bg-surface-state-pressed' }}
      className={cardClassName}
    >
      {content}
    </Link>
  )
}
