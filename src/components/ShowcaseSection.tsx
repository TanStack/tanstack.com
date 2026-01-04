import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  getFeaturedShowcasesQueryOptions,
  getShowcasesByLibraryQueryOptions,
} from '~/queries/showcases'
import { ShowcaseCard, ShowcaseCardSkeleton } from './ShowcaseCard'
import { buttonStyles } from './Button'
import { ArrowRight, Plus } from 'lucide-react'

interface ShowcaseSectionProps {
  title?: string
  subtitle?: string
  libraryId?: string
  limit?: number
  showViewAll?: boolean
  minItems?: number
}

export function SubmitShowcasePlaceholder({
  libraryId,
}: {
  libraryId?: string
}) {
  return (
    <Link
      to="/showcase/submit"
      search={libraryId ? { libraryId } : undefined}
      className="group block rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
    >
      <div className="aspect-video flex items-center justify-center bg-gray-50 dark:bg-gray-900/50">
        <div className="text-center p-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
            <Plus className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Submit your project
          </p>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          Your Project Here
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          Share what you've built with the community
        </p>
      </div>
    </Link>
  )
}

export function ShowcaseSection({
  title = 'Built with TanStack',
  subtitle = 'See what the community is building',
  libraryId,
  limit = 6,
  showViewAll = true,
  minItems = 3,
}: ShowcaseSectionProps) {
  const queryOptions = libraryId
    ? getShowcasesByLibraryQueryOptions({ libraryId, limit })
    : getFeaturedShowcasesQueryOptions({ limit })

  const { data, isLoading } = useQuery(queryOptions)

  const showcases = data?.showcases || []
  const placeholdersNeeded = Math.max(0, minItems - showcases.length)

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
          {Array.from({ length: Math.max(limit, minItems) }).map((_, i) => (
            <ShowcaseCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {showcases.map(({ showcase, user }) => (
            <ShowcaseCard key={showcase.id} showcase={showcase} user={user} />
          ))}
          {Array.from({ length: placeholdersNeeded }).map((_, i) => (
            <SubmitShowcasePlaceholder
              key={`placeholder-${i}`}
              libraryId={libraryId}
            />
          ))}
        </div>
      )}

      {showViewAll && (
        <div className="mt-8 flex justify-center">
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
