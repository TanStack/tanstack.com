import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { BlogFilterBar } from '~/components/BlogFilterBar'
import { type BlogCardPost } from '~/components/BlogCard'
import { Eyebrow } from '~/components/ds/ui'
import { PartnerRail } from '~/components/ds/ui/PartnerRail'
import { BlogPostCard } from '~/components/ds/ui/BlogPostCard'
import { PageHeader } from '~/components/ds/ui/PageHeader'
import { libraries, type LibrarySlim } from '~/libraries'
import {
  getDistinctAuthors,
  normalizeBlogAuthor,
  searchBlogCardPosts,
} from '~/utils/blog-format'
import { fetchBlogIndexPosts } from '~/utils/blog.functions'
import { partners } from '~/utils/partners'
import { PostNotFound } from './blog'

const searchSchema = v.object({
  author: v.fallback(v.optional(v.string()), undefined),
  q: v.fallback(v.optional(v.string()), undefined),
  library: v.fallback(v.optional(v.string()), undefined),
  year: v.fallback(v.optional(v.string()), undefined),
})

// How many grid cards to show before "Load more"; each click reveals another batch.
const POSTS_PER_PAGE = 12

function postMatchesLibrary(post: BlogCardPost, libraryId: string): boolean {
  return post.library?.split(',').some((id) => id.trim() === libraryId) ?? false
}

// Split an already-sorted (newest-first) list into consecutive year buckets so
// the grid can drop in "2026 / 2025 / …" separators for temporal wayfinding.
function groupPostsByYear(
  posts: BlogCardPost[],
): Array<{ year: string; posts: BlogCardPost[] }> {
  const groups: Array<{ year: string; posts: BlogCardPost[] }> = []
  for (const post of posts) {
    const year = post.published?.slice(0, 4) || 'Undated'
    const lastGroup = groups[groups.length - 1]
    if (lastGroup?.year === year) {
      lastGroup.posts.push(post)
    } else {
      groups.push({ year, posts: [post] })
    }
  }
  return groups
}

export const Route = createFileRoute('/blog/')({
  staleTime: Infinity,
  validateSearch: searchSchema,
  loader: () => fetchBlogIndexPosts(),
  notFoundComponent: () => <PostNotFound />,
  component: BlogIndex,
  head: () => ({
    meta: [
      {
        title: 'Blog',
      },
    ],
  }),
})

function getLibrariesWithPosts(posts: BlogCardPost[]): LibrarySlim[] {
  const ids = new Set<string>()
  for (const post of posts) {
    if (!post.library) continue
    for (const id of post.library.split(',')) {
      ids.add(id.trim())
    }
  }
  return libraries.filter((lib) => ids.has(lib.id))
}

function BlogIndex() {
  const frontMatters = Route.useLoaderData()
  const {
    author,
    q,
    library: selectedLibrary,
    year: selectedYear,
  } = Route.useSearch()
  const navigate = Route.useNavigate()
  const activePartners = partners.filter(
    (partner) => partner.status === 'active',
  )
  const selectedAuthor = author ? normalizeBlogAuthor(author) : undefined
  const searchQuery = q ?? ''

  const authors = getDistinctAuthors(frontMatters)
  const librariesWithPosts = getLibrariesWithPosts(frontMatters)

  // Counts give the browse nav its "scent" — computed once from every post.
  const libraryCounts = new Map<string, number>()
  const yearCounts = new Map<string, number>()
  for (const post of frontMatters) {
    if (post.library) {
      for (const id of post.library.split(',')) {
        const trimmed = id.trim()
        libraryCounts.set(trimmed, (libraryCounts.get(trimmed) ?? 0) + 1)
      }
    }
    const year = post.published?.slice(0, 4)
    if (year) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
  }
  const topics = librariesWithPosts.map((library) => ({
    library,
    count: libraryCounts.get(library.id) ?? 0,
  }))
  const years = [...yearCounts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => ({ year, count }))

  const authorFilteredPosts = selectedAuthor
    ? frontMatters.filter((post) => post.authors.includes(selectedAuthor))
    : frontMatters
  const libraryFilteredPosts = selectedLibrary
    ? authorFilteredPosts.filter((post) =>
        postMatchesLibrary(post, selectedLibrary),
      )
    : authorFilteredPosts
  const yearFilteredPosts = selectedYear
    ? libraryFilteredPosts.filter(
        (post) => post.published?.slice(0, 4) === selectedYear,
      )
    : libraryFilteredPosts
  const filteredPosts = searchBlogCardPosts(yearFilteredPosts, searchQuery)

  // With no filters active, promote the latest post to a full-width hero and
  // grid the rest; a hero makes no sense inside a filtered result set.
  const hasActiveFilters = Boolean(
    searchQuery || selectedAuthor || selectedLibrary || selectedYear,
  )
  const featuredPost = hasActiveFilters ? undefined : filteredPosts[0]
  const gridPosts = featuredPost ? filteredPosts.slice(1) : filteredPosts

  const [visibleCount, setVisibleCount] = React.useState(POSTS_PER_PAGE)
  // Index from which cards animate in. Set only when "Load more" reveals a
  // batch, so the entrance never fires on first paint or filter changes.
  const [animateFrom, setAnimateFrom] = React.useState(Number.POSITIVE_INFINITY)
  // Collapse back to the first page whenever the filtered set changes.
  React.useEffect(() => {
    setVisibleCount(POSTS_PER_PAGE)
    setAnimateFrom(Number.POSITIVE_INFINITY)
  }, [searchQuery, selectedAuthor, selectedLibrary, selectedYear])
  const visiblePosts = gridPosts.slice(0, visibleCount)
  const remainingCount = gridPosts.length - visiblePosts.length
  // Flat position of each visible post, so the grouped-by-year grid can tell
  // which cards belong to the freshly revealed batch.
  const postIndexBySlug = new Map(
    visiblePosts.map((post, index) => [post.slug, index]),
  )

  // Search moved to the top bar; the sidebar/mobile nav only carry the facets.
  const onSearchChange = (query: string) =>
    navigate({
      search: (prev) => ({ ...prev, q: query || undefined }),
      replace: true,
    })

  // Everything the inline filter bar needs: search + the three URL-backed facets.
  const filterBarProps = {
    searchQuery,
    onSearchChange,
    topics,
    totalCount: frontMatters.length,
    selectedLibrary,
    onLibraryToggle: (libraryId: string | undefined) =>
      navigate({
        search: (prev) => ({ ...prev, library: libraryId }),
        replace: true,
      }),
    authors,
    selectedAuthor,
    onAuthorChange: (nextAuthor: string | undefined) =>
      navigate({
        search: (prev) => ({ ...prev, author: nextAuthor }),
        replace: true,
      }),
    years,
    selectedYear,
    onYearToggle: (nextYear: string | undefined) =>
      navigate({
        search: (prev) => ({ ...prev, year: nextYear }),
        replace: true,
      }),
    hasActiveFilters,
    onClearAll: () => navigate({ search: () => ({}), replace: true }),
  }

  return (
    <div className="flex flex-col max-w-full min-h-screen">
      <div className="relative flex-1 w-full mb-16">
        <div className="p-4 md:p-8">
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="space-y-6 pt-6">
              <PageHeader
                align="center"
                title="Blog"
                lede="The latest news and blog posts from TanStack"
              />
              {/* Search on the left, the facet filters and RSS on the right —
                  one toolbar spanning the content width. On narrow screens the
                  facets collapse behind a single toggle. */}
              <BlogFilterBar {...filterBarProps} />
            </div>

            {/* The toolbar sits 8px above this divider, which tops the content
                column beneath it. */}
            <div className="mt-2 border-t border-border-subtle" />

            <div className="mt-10">
              <div className="min-w-0 space-y-8">
                {featuredPost ? (
                  <section aria-label="Latest post">
                    <BlogPostCard
                      post={featuredPost}
                      featured
                      showCategory
                      showLibraryBadges={false}
                    />
                  </section>
                ) : null}

                <div className="space-y-10">
                  {groupPostsByYear(visiblePosts).map((group) => (
                    <section key={group.year} className="space-y-5">
                      <div className="flex items-center gap-3">
                        <Eyebrow tone="muted">{group.year}</Eyebrow>
                        <span className="h-px flex-1 bg-border-subtle" />
                      </div>
                      <div className="blog-year-grid">
                        {group.posts.map((post) => {
                          const offset =
                            (postIndexBySlug.get(post.slug) ?? 0) - animateFrom
                          const enterClass =
                            offset >= 0
                              ? `blog-card-enter enter-${Math.min(offset, 5)}`
                              : undefined
                          return (
                            <BlogPostCard
                              key={post.slug}
                              post={post}
                              size="lg"
                              showCategory
                              showLibraryBadges={false}
                              className={enterClass}
                            />
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                {remainingCount > 0 ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAnimateFrom(visibleCount)
                        setVisibleCount((count) => count + POSTS_PER_PAGE)
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-border-default px-5 py-2.5 text-sm font-bold transition-colors hover:border-blue-500 hover:text-blue-500"
                    >
                      Load more posts
                      <span className="font-medium text-text-muted">
                        {remainingCount} more
                      </span>
                    </button>
                  </div>
                ) : null}

                {filteredPosts.length === 0 ? (
                  <div className="py-8 text-center text-text-secondary">
                    No posts found
                    {searchQuery ? (
                      <>
                        {' '}
                        matching{' '}
                        <span className="font-medium">{searchQuery}</span>
                      </>
                    ) : null}
                    {selectedAuthor ? (
                      <>
                        {' '}
                        by <span className="font-medium">{selectedAuthor}</span>
                      </>
                    ) : null}
                    .
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {/* Partner rail floats in the right gutter — absolutely positioned, so
            it's OUT of the content's layout flow and the masthead/posts stay
            centered on the page (under the main nav) regardless of the rail. It
            shows only when the viewport is wide enough (~1900px) to seat a 300px
            rail beside the centered 1280px content without overlapping it. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden min-[1900px]:block">
          <div className="pointer-events-auto sticky top-[calc(var(--navbar-height)+1.5rem)] mr-4 flex max-h-[calc(100dvh-var(--navbar-height)-2rem)] w-[220px] flex-col overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <PartnerRail
              analyticsPlacement="blog_rail"
              partners={activePartners}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
