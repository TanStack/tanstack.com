import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { useMounted } from '~/hooks/useMounted'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'
import { FeedPageLayout } from '~/components/FeedPageLayout'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import { useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import { FaLock } from 'react-icons/fa'

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

const releaseLevelSchema = z.enum(['major', 'minor', 'patch'])

export const Route = createFileRoute('/_libraries/feed')({
  component: FeedPage,
  validateSearch: (search) => {
    // Check if releaseLevels exists in raw search params
    // If it exists (even as empty array), use it as-is
    // If it doesn't exist, apply defaults
    const hasReleaseLevels = 'releaseLevels' in search
    const releaseLevelsValue = search.releaseLevels

    const parsed = z
      .object({
        sources: z.array(z.string()).optional().catch(undefined),
        libraries: z.array(librarySchema).optional().catch(undefined),
        categories: z.array(categorySchema).optional().catch(undefined),
        partners: z.array(z.string()).optional().catch(undefined),
        tags: z.array(z.string()).optional().catch(undefined),
        releaseLevels: hasReleaseLevels
          ? // If key exists, use the value (even if empty array)
            z
              .array(releaseLevelSchema)
              .catch(
                Array.isArray(releaseLevelsValue) ? releaseLevelsValue : []
              )
          : // If key doesn't exist, apply defaults
            z
              .array(releaseLevelSchema)
              .optional()
              .default(['major', 'minor'])
              .catch(['major', 'minor']),
        includePrerelease: z.boolean().optional().default(true).catch(true),
        featured: z.boolean().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        page: z.number().optional().default(1).catch(1),
        pageSize: z.number().int().positive().optional().default(20).catch(20),
      })
      .parse(search)

    return parsed
  },
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
  const user = useQuery(api.auth.getCurrentUser)

  // Check if user has feed access capability
  const canAccessFeed =
    user?.capabilities?.includes('feed') ||
    user?.capabilities?.includes('admin') ||
    false

  // Show loading while checking auth
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  // Show access denied if user doesn't have capability
  if (!canAccessFeed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaLock className="text-4xl text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the feed.
          </p>
          <Link
            to="/"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg inline-block"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

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

  const feedQuery = useFeedQuery({
    page: effectiveFilters.page ?? 1,
    pageSize: effectiveFilters.pageSize ?? 20,
    filters: {
      sources: effectiveFilters.sources,
      libraries: effectiveFilters.libraries,
      categories: effectiveFilters.categories,
      partners: effectiveFilters.partners,
      tags: effectiveFilters.tags,
      releaseLevels: effectiveFilters.releaseLevels,
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
    },
  })

  const handleFiltersChange = (newFilters: Partial<typeof search>): void => {
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
        releaseLevels: ['major', 'minor'],
        includePrerelease: true,
        page: 1,
        pageSize: effectiveFilters.pageSize ?? 20,
      },
      replace: true,
    })

    if (typeof window !== 'undefined') {
      localStorage.removeItem('feedFilters')
      setSavedFilters(null)
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    navigate({
      search: (s) => ({
        ...s,
        pageSize: newPageSize,
        page: 1,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  return (
    <FeedPageLayout.Root
      feedQuery={feedQuery}
      currentPage={effectiveFilters.page ?? 1}
      pageSize={effectiveFilters.pageSize ?? 20}
      filters={effectiveFilters as any}
      onFiltersChange={handleFiltersChange as any}
      onClearFilters={handleClearFilters}
      onPageChange={(page) => {
        navigate({
          search: (s) => ({ ...s, page }),
          replace: true,
          resetScroll: false,
        })
      }}
      onPageSizeChange={handlePageSizeChange}
    >
      <FeedPageLayout.Header
        title="Feed"
        description="Stay up to date with all TanStack updates, releases, announcements, and blog posts"
      />
      <div className="flex flex-col lg:flex-row gap-8">
        <FeedPageLayout.Filters />
        <FeedPageLayout.Content />
      </div>
      <FeedPageLayout.Footer>
        <Footer />
      </FeedPageLayout.Footer>
    </FeedPageLayout.Root>
  )
}
