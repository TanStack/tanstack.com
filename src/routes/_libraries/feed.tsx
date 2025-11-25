import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { useMounted } from '~/hooks/useMounted'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'
import { FeedList } from '~/components/FeedList'
import { FeedFilters } from '~/components/FeedFilters'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'

const librarySchema = z.enum([
  'start',
  'router',
  'query',
  'table',
  'form',
  'virtual',
  'ranger',
  'store',
  'pacer',
  'db',
  'config',
  'react-charts',
  'devtools',
  'create-tsrouter-app',
])

const categorySchema = z.enum([
  'release',
  'announcement',
  'blog',
  'partner',
  'update',
  'other',
])

export const Route = createFileRoute('/_libraries/feed')({
  component: FeedPage,
  validateSearch: z.object({
    sources: z.array(z.string()).optional().catch(undefined),
    libraries: z.array(librarySchema).optional().catch(undefined),
    categories: z.array(categorySchema).optional().catch(undefined),
    partners: z.array(z.string()).optional().catch(undefined),
    tags: z.array(z.string()).optional().catch(undefined),
    hidePatch: z.boolean().optional().default(true).catch(true),
    featured: z.boolean().optional().catch(undefined),
    search: z.string().optional().catch(undefined),
    page: z.number().optional().default(1).catch(1),
  }),
  head: () => ({
    meta: seo({
      title: 'Feed',
      description:
        'Stay up to date with all TanStack updates, releases, announcements, and blog posts',
    }),
  }),
})

function FeedPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const mounted = useMounted()

  // Load saved filter preferences from localStorage (only on client)
  const [savedFilters, setSavedFilters] = useState<typeof search | null>(null)

  useEffect(() => {
    if (mounted) {
      const saved = localStorage.getItem('feedFilters')
      if (saved) {
        try {
          setSavedFilters(JSON.parse(saved))
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, [mounted])

  // Merge saved filters with URL params (URL params take precedence)
  const effectiveFilters = {
    ...savedFilters,
    ...search,
  }

  const feedQuery = useQuery(
    convexQuery(api.feed.queries.listFeedEntries, {
      pagination: {
        limit: 20,
        page: effectiveFilters.page ? effectiveFilters.page - 1 : 0,
      },
      filters: {
        sources: effectiveFilters.sources,
        libraries: effectiveFilters.libraries,
        categories: effectiveFilters.categories,
        partners: effectiveFilters.partners,
        tags: effectiveFilters.tags,
        hidePatch: effectiveFilters.hidePatch ?? true,
        featured: effectiveFilters.featured,
        search: effectiveFilters.search,
      },
    })
  )

  const handleFiltersChange = (newFilters: Partial<typeof search>) => {
    navigate({
      search: (s) => ({
        ...s,
        ...newFilters,
        page: 1,
      }),
      replace: true,
    })

    // Save to localStorage
    if (typeof window !== 'undefined') {
      const updatedFilters = { ...search, ...newFilters, page: 1 }
      localStorage.setItem('feedFilters', JSON.stringify(updatedFilters))
      setSavedFilters(updatedFilters)
    }
  }

  const handleClearFilters = () => {
    navigate({
      search: {
        hidePatch: true,
        page: 1,
      },
      replace: true,
    })

    if (typeof window !== 'undefined') {
      localStorage.removeItem('feedFilters')
      setSavedFilters(null)
    }
  }

  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-7xl mx-auto">
        <header className="">
          <h1 className="text-3xl font-black">Feed</h1>
          <p className="text-lg mt-4 text-gray-700 dark:text-gray-300">
            Stay up to date with all TanStack updates, releases, announcements,
            and blog posts
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <FeedFilters
              libraries={libraries}
              partners={partners}
              selectedSources={effectiveFilters.sources}
              selectedLibraries={effectiveFilters.libraries}
              selectedCategories={effectiveFilters.categories}
              selectedPartners={effectiveFilters.partners}
              selectedTags={effectiveFilters.tags}
              hidePatch={effectiveFilters.hidePatch ?? true}
              featured={effectiveFilters.featured}
              search={effectiveFilters.search}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
            />
          </aside>

          {/* Feed Content */}
          <main className="flex-1">
            <FeedList
              query={feedQuery}
              currentPage={effectiveFilters.page ?? 1}
              onPageChange={(page) => {
                navigate({
                  search: (s) => ({ ...s, page }),
                  replace: true,
                })
              }}
            />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
