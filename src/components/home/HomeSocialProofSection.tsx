import { Link } from '@tanstack/react-router'
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
    <div className="space-y-24">
      <PartnersSponsorsContent
        analyticsPlacement="home_grid"
        previousLinkAlign="end"
      />

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
          <div className="mt-6 flex justify-end">
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
