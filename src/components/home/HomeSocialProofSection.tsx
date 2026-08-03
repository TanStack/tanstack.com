import { Link } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { BlogPostCard } from '~/components/ds/ui/BlogPostCard'
import { Button } from '~/components/ds/ui'
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
    <div className="space-y-24">
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <div className="h-10 w-40 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse mb-6" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          {[2, 3].map((cols, band) => (
            <div key={`partner-band-${band}`}>
              <div className="h-12 bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
              <div
                className="grid gap-px bg-gray-200/70 dark:bg-gray-800/70"
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: cols * 2 }).map((_, index) => (
                  <div
                    key={`partner-skeleton-${band}-${index}`}
                    className="min-h-[130px] bg-white/70 dark:bg-gray-950/60 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <div className="h-10 w-56 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`post-skeleton-${index}`}
              className="animate-pulse rounded-xl corner-squircle p-2"
            >
              <div className="aspect-video rounded-lg corner-squircle bg-gray-100 dark:bg-gray-800" />
              <div className="px-0.5 pt-2.5">
                <div className="h-5 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-3 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-3 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
