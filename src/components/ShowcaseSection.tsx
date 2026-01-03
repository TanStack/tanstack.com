import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  getFeaturedShowcasesQueryOptions,
  getShowcasesByLibraryQueryOptions,
} from '~/queries/showcases'
import { ShowcaseCard, ShowcaseCardSkeleton } from './ShowcaseCard'
import { buttonStyles } from './Button'
import { ArrowRight } from 'lucide-react'

interface ShowcaseSectionProps {
  title?: string
  subtitle?: string
  libraryId?: string
  limit?: number
  showViewAll?: boolean
}

export function ShowcaseSection({
  title = 'Built with TanStack',
  subtitle = 'See what the community is building',
  libraryId,
  limit = 6,
  showViewAll = true,
}: ShowcaseSectionProps) {
  const queryOptions = libraryId
    ? getShowcasesByLibraryQueryOptions({ libraryId, limit })
    : getFeaturedShowcasesQueryOptions({ limit })

  const { data, isLoading } = useQuery(queryOptions)

  const showcases = data?.showcases || []

  // Don't render anything if no showcases
  if (!isLoading && showcases.length === 0) {
    return null
  }

  return (
    <section className="py-16">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          {subtitle}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: limit }).map((_, i) => (
            <ShowcaseCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {showcases.map(({ showcase, user }) => (
            <ShowcaseCard key={showcase.id} showcase={showcase} user={user} />
          ))}
        </div>
      )}

      {showViewAll && (
        <div className="mt-8 text-center">
          <Link
            to="/showcase"
            search={libraryId ? { libraryId } : undefined}
            className={buttonStyles}
          >
            View all projects
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )
}

/**
 * Featured showcases for homepage (after partners, before blog)
 */
export function FeaturedShowcases() {
  return (
    <ShowcaseSection
      title="Built with TanStack"
      subtitle="Discover projects from the community"
      limit={6}
    />
  )
}

/**
 * Library-specific showcases (for per-library landing pages)
 */
export function LibraryShowcases({
  libraryId,
  libraryName,
}: {
  libraryId: string
  libraryName: string
}) {
  return (
    <ShowcaseSection
      title={`Built with ${libraryName}`}
      subtitle="See how developers are using this library"
      libraryId={libraryId}
      limit={3}
    />
  )
}
