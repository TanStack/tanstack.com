import { ArrowLeftIcon } from '@phosphor-icons/react'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { BlogPostCard } from '~/components/ds/ui/BlogPostCard'
import { PageHeader } from '~/components/ds/ui/PageHeader'
import { Button, FormSelect, SearchInput } from '~/components/ds/ui'
import { DocContainer } from '~/components/DocContainer'
import { getLibrary, type LibraryId } from '~/libraries'
import {
  getDistinctAuthors,
  normalizeBlogAuthor,
  searchBlogCardPosts,
} from '~/utils/blog-format'
import { fetchBlogPostsForLibrary } from '~/utils/blog.functions'

const searchSchema = v.object({
  author: v.fallback(v.optional(v.string()), undefined),
  q: v.fallback(v.optional(v.string()), undefined),
})

export const Route = createFileRoute('/_library/$libraryId/$version/docs/blog')(
  {
    staleTime: Infinity,
    validateSearch: searchSchema,
    loader: ({ params }) =>
      fetchBlogPostsForLibrary({ data: params.libraryId }),
    component: RouteComponent,
  },
)

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const { author, q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const library = getLibrary(libraryId as LibraryId)
  const searchQuery = q ?? ''

  const posts = Route.useLoaderData()
  const authors = getDistinctAuthors(posts)
  const normalizedAuthor = author ? normalizeBlogAuthor(author) : undefined
  const selectedAuthor =
    normalizedAuthor && authors.includes(normalizedAuthor)
      ? normalizedAuthor
      : undefined

  const authorFilteredPosts = selectedAuthor
    ? posts.filter((post) => post.authors.includes(selectedAuthor))
    : posts
  const filteredPosts = searchBlogCardPosts(authorFilteredPosts, searchQuery)

  return (
    <DocContainer>
      <div className="w-full max-w-[1600px] mx-auto">
        <div className="flex overflow-auto flex-col w-full p-4 lg:p-6">
          <div className="flex flex-col items-center border-b border-border-subtle pb-6 text-center">
            <PageHeader
              align="center"
              title={`${library.name.replace('TanStack ', '')} Blog`}
            />
            <Button
              as={Link}
              to="/blog"
              variant="link"
              color="gray"
              className="mt-3.5"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              See all blog posts
            </Button>
          </div>

          {/* Centered search + single-select author filter, DS input styles. */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <div className="w-72 max-w-full">
              <SearchInput
                id="docs-blog-search-filter"
                value={searchQuery}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      q: event.currentTarget.value || undefined,
                    }),
                    replace: true,
                  })
                }
                placeholder="Search posts..."
              />
            </div>
            {authors.length > 0 ? (
              <div className="w-56 max-w-full">
                <FormSelect
                  aria-label="Filter by author"
                  value={selectedAuthor ?? ''}
                  onChange={(event) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        author: event.currentTarget.value || undefined,
                      }),
                      replace: true,
                    })
                  }
                >
                  <option value="">All authors</option>
                  {authors.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </FormSelect>
              </div>
            ) : null}
          </div>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
            {filteredPosts.map((post) => (
              <BlogPostCard
                key={post.slug}
                post={post}
                size="lg"
                showLibraryBadges={false}
              />
            ))}
          </section>

          {filteredPosts.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-400 py-12">
              {posts.length === 0
                ? `No blog posts yet for ${library.name}.`
                : `No posts found${
                    searchQuery ? ` matching ${searchQuery}` : ''
                  }${selectedAuthor ? ` by ${selectedAuthor}` : ''}.`}
            </div>
          ) : null}

          <div className="h-12" />
        </div>
      </div>
    </DocContainer>
  )
}
