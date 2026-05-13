import { Link, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { ArrowLeft } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { BlogCard } from '~/components/BlogCard'
import { BlogAuthorFilter } from '~/components/BlogAuthorFilter'
import { getLibrary, type LibraryId } from '~/libraries'
import { getDistinctAuthors, getPostsForLibrary } from '~/utils/blog'

const searchSchema = v.object({
  author: v.fallback(v.optional(v.string()), undefined),
})

export const Route = createFileRoute('/$libraryId/$version/docs/blog')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const { author } = Route.useSearch()
  const navigate = Route.useNavigate()
  const library = getLibrary(libraryId as LibraryId)

  const posts = getPostsForLibrary(libraryId as LibraryId)
  const authors = getDistinctAuthors(posts)

  const filteredPosts = author
    ? posts.filter((post) => post.authors.includes(author))
    : posts

  return (
    <DocContainer>
      <div
        className={twMerge(
          'w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-[1200px]',
        )}
      >
        <div
          className={twMerge('flex overflow-auto flex-col w-full p-4 lg:p-6')}
        >
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all posts
          </Link>

          <DocTitle>{library.name} Blog</DocTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Posts about {library.name}.
          </p>

          {authors.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <label
                htmlFor="docs-blog-author-filter"
                className="text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Author
              </label>
              <div id="docs-blog-author-filter" className="w-64 max-w-full">
                <BlogAuthorFilter
                  authors={authors}
                  selected={author}
                  onSelect={(nextAuthor) =>
                    navigate({
                      search: () => ({ author: nextAuthor }),
                      replace: true,
                    })
                  }
                />
              </div>
            </div>
          ) : null}

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
            {filteredPosts.map((post) => (
              <BlogCard
                key={post.slug}
                post={{
                  slug: post.slug,
                  title: post.title,
                  published: post.published,
                  excerpt: post.excerpt,
                  headerImage: post.headerImage,
                  authors: post.authors,
                  library: post.library,
                }}
                showLibraryBadges={false}
              />
            ))}
          </section>

          {filteredPosts.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-400 py-12">
              {posts.length === 0
                ? `No blog posts yet for ${library.name}.`
                : `No posts found${author ? ` by ${author}` : ''}.`}
            </div>
          ) : null}

          <div className="h-12" />
        </div>
      </div>
    </DocContainer>
  )
}
