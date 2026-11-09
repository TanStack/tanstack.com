import { Link } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { BlogPostCard } from '~/components/ds/ui/BlogPostCard'
import { Button, Skeleton, SkeletonGroup } from '~/components/ds/ui'
import { PartnersSponsorsContent } from '~/components/PartnersSponsorsSection'
import type { RecentPost } from '~/utils/blog.functions'

type HomeSocialProofSectionProps = {
  recentPosts: ReadonlyArray<RecentPost>
}

export function HomeSocialProofSection({
  recentPosts,
}: HomeSocialProofSectionProps) {
  return (
    <Hydrate
      when={visible({ rootMargin: '25%' })}
      fallback={<SocialProofSkeleton />}
    >
      <HomeSocialProofContent recentPosts={recentPosts} />
    </Hydrate>
  )
}

function SocialProofSkeleton() {
  return (
    <SkeletonGroup label="Loading partners and posts" className="space-y-24">
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <Skeleton className="h-10 w-40 mb-6" />
        <div className="overflow-hidden rounded-2xl corner-squircle border border-border-default">
          {[2, 3].map((cols, band) => (
            <div key={`partner-band-${band}`}>
              <Skeleton className="h-12 rounded-none" />
              <div
                className="grid gap-px bg-border-default"
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: cols * 2 }).map((_, index) => (
                  <Skeleton
                    key={`partner-skeleton-${band}-${index}`}
                    className="min-h-[130px] rounded-none"
                  />
                ))}
              </div>
            </div>
          ))}
          <Skeleton className="h-12 rounded-none" />
          <Skeleton className="h-[420px] rounded-none sm:h-[480px] lg:h-[540px]" />
        </div>
      </div>
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <Skeleton className="mb-3 ml-1 h-4 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`post-skeleton-${index}`}
              className="rounded-xl corner-squircle p-2"
            >
              <Skeleton className="aspect-video rounded-lg corner-squircle" />
              <div className="px-0.5 pt-2.5">
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="mt-3 h-3 w-2/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3" />
                  <Skeleton className="h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  )
}

function HomeSocialProofContent({ recentPosts }: HomeSocialProofSectionProps) {
  return (
    <div className="space-y-24">
      <PartnersSponsorsContent analyticsPlacement="home_grid" />

      {recentPosts.length > 0 && (
        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
          <h3
            id="blog"
            className="mb-3 scroll-mt-24 px-1 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted"
          >
            <a
              href="#blog"
              className="transition-colors hover:text-text-primary"
            >
              Blog &amp; Release Notes
            </a>
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {recentPosts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
          <div className="flex justify-center mt-6">
            <Button as={Link} to="/blog" variant="subtle-link" color="gray">
              View All Posts
              <ArrowRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
