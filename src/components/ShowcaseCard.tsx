import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { ExternalLink } from 'lucide-react'
import { libraries } from '~/libraries'
import type { Showcase } from '~/db/schema'

interface ShowcaseCardProps {
  showcase: Showcase
  user?: {
    id: string
    name: string | null
    image: string | null
  } | null
  className?: string
}

const libraryMap = new Map(libraries.map((lib) => [lib.id, lib]))

export function ShowcaseCard({ showcase, className }: ShowcaseCardProps) {
  return (
    <a
      href={showcase.url}
      target="_blank"
      rel="noopener noreferrer"
      className={twMerge(
        'group block rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700',
        className,
      )}
    >
      {/* Screenshot */}
      <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-900">
        <img
          src={showcase.screenshotUrl}
          alt={showcase.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Logo overlay */}
        {showcase.logoUrl && (
          <div className="absolute bottom-3 left-3 w-10 h-10 rounded-lg bg-white dark:bg-gray-800 shadow-md overflow-hidden">
            <img
              src={showcase.logoUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {/* External link indicator */}
        <div className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {showcase.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
          {showcase.tagline}
        </p>

        {/* Libraries */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {showcase.libraries.slice(0, 4).map((libId) => {
            const lib = libraryMap.get(libId)
            return (
              <span
                key={libId}
                className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {lib?.name?.replace('TanStack ', '') || libId}
              </span>
            )
          })}
          {showcase.libraries.length > 4 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
              +{showcase.libraries.length - 4}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

export function ShowcaseCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="aspect-video bg-gray-200 dark:bg-gray-700" />
      <div className="p-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mt-2" />
        <div className="flex gap-1.5 mt-3">
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    </div>
  )
}
