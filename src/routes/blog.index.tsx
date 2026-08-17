import * as React from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { BlogBrowseNav } from '~/components/BlogBrowseNav'
import { type BlogCardPost } from '~/components/BlogCard'
import { Eyebrow } from '~/components/ds/ui'
import { BlogPostCard } from '~/components/ds/ui/BlogPostCard'
import { PageHeader } from '~/components/ds/ui/PageHeader'
import { PartnersRail, RightRail } from '~/components/RightRail'
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
  // Collapse back to the first page whenever the filtered set changes.
  React.useEffect(() => {
    setVisibleCount(POSTS_PER_PAGE)
  }, [searchQuery, selectedAuthor, selectedLibrary, selectedYear])
  const visiblePosts = gridPosts.slice(0, visibleCount)
  const remainingCount = gridPosts.length - visiblePosts.length

  // Shared by the desktop sidebar and the mobile disclosure copies of the nav.
  const browseNavProps = {
    searchQuery,
    onSearchChange: (query: string) =>
      navigate({
        search: (prev) => ({ ...prev, q: query || undefined }),
        replace: true,
      }),
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
      <div className="flex-1 flex w-full mb-16">
        <div className="flex-1 p-4 md:p-8 min-w-0">
          <div className="mx-auto w-full max-w-[1280px] space-y-10">
            <PageHeader
              align="center"
              withDivider
              title="Blog"
              lede="The latest news and blog posts from TanStack"
            />

            <div className="flex gap-8">
              {/* Desktop: the browse rail floats to the left of the content. */}
              <aside className="hidden w-[224px] shrink-0 xl:block">
                <div className="sticky top-[calc(var(--navbar-height)+1.5rem)]">
                  <BlogBrowseNav
                    idPrefix="blog-nav-desktop"
                    {...browseNavProps}
                  />
                </div>
              </aside>

              <div className="min-w-0 flex-1 space-y-8">
                {/* Below xl the same nav collapses into a disclosure. */}
                <details className="group rounded-lg border border-border-subtle xl:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    Filter &amp; browse
                    <CaretDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-border-subtle px-4 py-4">
                    <BlogBrowseNav
                      idPrefix="blog-nav-mobile"
                      {...browseNavProps}
                    />
                  </div>
                </details>

                {featuredPost ? (
                  <section aria-label="Latest post">
                    <BlogPostCard post={featuredPost} featured />
                  </section>
                ) : null}

                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {groupPostsByYear(visiblePosts).map((group) => (
                    <React.Fragment key={group.year}>
                      <div className="col-span-full flex items-center gap-3 pt-2 first:pt-0">
                        <Eyebrow tone="muted">{group.year}</Eyebrow>
                        <span className="h-px flex-1 bg-border-subtle" />
                      </div>
                      {group.posts.map((post) => (
                        <BlogPostCard key={post.slug} post={post} size="lg" />
                      ))}
                    </React.Fragment>
                  ))}
                </section>

                {remainingCount > 0 ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount((count) => count + POSTS_PER_PAGE)
                      }
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
        <RightRail breakpoint="md">
          <PartnersRail
            analyticsPlacement="blog_rail"
            partners={activePartners}
          />
        </RightRail>
      </div>
    </div>
  )
}
