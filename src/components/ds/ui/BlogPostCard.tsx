import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { CoverFallback } from '~/components/CoverFallback'
import { formatAuthors, formatPublishedDate } from '~/utils/blog-format'
import type { RecentPost } from '~/utils/blog.functions'
import { getOptimizedImageUrl } from '~/utils/optimizedImage'

export function BlogPostCard({
  className,
  onNavigate,
  post,
}: {
  className?: string
  onNavigate?: () => void
  post: RecentPost
}) {
  const cardClassName = twMerge(
    'group/post flex flex-col gap-3 rounded-xl corner-squircle p-3 transition-colors hover:bg-surface-state-hover focus-visible:bg-surface-state-hover focus-visible:outline-none',
    className,
  )
  const content = (
    <>
      {post.headerImage ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg corner-squircle border border-border-subtle">
          <img
            src={getOptimizedImageUrl(post.headerImage, {
              fit: 'cover',
              format: 'auto',
              quality: 80,
              width: 640,
            })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <CoverFallback
          slug={post.slug}
          className="aspect-video w-full rounded-lg corner-squircle"
        />
      )}
      <div className="flex flex-col gap-1 px-1 pb-1">
        <div className="line-clamp-1 font-ds-display text-ds-heading-5 text-text-primary">
          {post.title}
        </div>
        <p className="line-clamp-2 text-ds-body-xs text-text-secondary">
          {post.excerpt}
        </p>
        <div className="mt-0.5 font-ds-mono text-ds-mono-xs text-text-muted">
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
