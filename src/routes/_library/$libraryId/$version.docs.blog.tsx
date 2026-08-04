import { ArrowLeftIcon } from '@phosphor-icons/react'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { BlogAuthorFilter } from '~/components/BlogAuthorFilter'
import { BlogCard } from '~/components/BlogCard'
import { BlogSearchFilter } from '~/components/BlogSearchFilter'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
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
  const selectedAuthor = author ? normalizeBlogAuthor(author) : undefined
  const searchQuery = q ?? ''

  const posts = Route.useLoaderData()
  const authors = getDistinctAuthors(posts)

  const authorFilteredPosts = selectedAuthor
    ? posts.filter((post) => post.authors.includes(selectedAuthor))
    : posts
  const filteredPosts = searchBlogCardPosts(authorFilteredPosts, searchQuery)

  return (
    <DocContainer>
      <div className="w-full max-w-[1600px] mx-auto">
        <div className="flex overflow-auto flex-col w-full p-4 lg:p-6">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to all posts
          </Link>

          <DocTitle>{library.name} Blog</DocTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Posts about {library.name}.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <div className="flex items-center gap-3">
              <label
                htmlFor="docs-blog-search-filter"
                className="text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Search
              </label>
              <BlogSearchFilter
                id="docs-blog-search-filter"
                value={searchQuery}
                onChange={(nextQuery) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      q: nextQuery || undefined,
                    }),
                    replace: true,
                  })
                }
                className="w-72 max-w-full"
              />
            </div>
            {authors.length > 0 ? (
              <div className="flex items-center gap-3">
                <label
                  htmlFor="docs-blog-author-filter"
                  className="text-sm font-medium text-gray-600 dark:text-gray-400"
                >
                  Author
                </label>
                <div id="docs-blog-author-filter" className="w-64 max-w-full">
                  <BlogAuthorFilter
                    authors={authors}
                    selected={selectedAuthor}
                    onSelect={(nextAuthor) =>
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          author: nextAuthor,
                        }),
                        replace: true,
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
            {filteredPosts.map((post) => (
              <BlogCard key={post.slug} post={post} showLibraryBadges={false} />
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
