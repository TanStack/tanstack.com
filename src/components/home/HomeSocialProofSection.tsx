import { Link } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRight } from '@phosphor-icons/react'
import { Button, Card } from '~/components/ds/ui'
import { PartnersSponsorsContent } from '~/components/PartnersSponsorsSection'
import { formatAuthors, formatPublishedDate } from '~/utils/blog-format'
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
            <Card
              key={`post-skeleton-${index}`}
              className="overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-gray-100 dark:bg-gray-800" />
              <div className="p-4">
                <div className="h-5 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-3 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-3 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            </Card>
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
          <h3 id="blog" className="text-3xl font-bold mb-6 scroll-mt-24">
            <a
              href="#blog"
              className="hover:underline decoration-gray-400 dark:decoration-gray-600"
            >
              Latest Blog Posts
            </a>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentPosts.map(
              ({ slug, title, published, excerpt, headerImage, authors }) => {
                return (
                  // DS Card isn't polymorphic, so the Link wraps it and drives
                  // the hover via group-hover.
                  <Link
                    key={slug}
                    to="/blog/$"
                    params={{ _splat: slug } as never}
                    className="group block h-full"
                  >
                    <Card className="flex h-full flex-col justify-between overflow-hidden transition-all group-hover:border-border-focus group-hover:shadow-lg">
                      {headerImage ? (
                        <div className="aspect-video overflow-hidden bg-gray-100 dark:bg-gray-800">
                          <img
                            src={headerImage}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
                        <div>
                          <div className="text-base font-bold">{title}</div>
                          <div className="text-xs italic font-light mt-1 text-gray-600 dark:text-gray-400">
                            by {formatAuthors(authors)}
                            {published ? (
                              <time
                                dateTime={published}
                                title={formatPublishedDate(published)}
                              >
                                {' '}
                                on {formatPublishedDate(published)}
                              </time>
                            ) : null}
                          </div>
                          {excerpt ? (
                            <p className="text-sm mt-3 text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed">
                              {excerpt}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-text-accent uppercase font-bold text-xs">
                          Read More →
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              },
            )}
          </div>
          <div className="flex justify-center mt-6">
            <Button as={Link} to="/blog">
              View All Posts
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
