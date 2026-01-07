import { twMerge } from 'tailwind-merge'
import { useMatches, useParams } from '@tanstack/react-router'
import { findLibrary } from '~/libraries'

export function BackgroundGradient() {
  let libraryId = useParams({
    select: (p) => p.libraryId,
    strict: false,
  }) as string

  const matches = useMatches()

  if (!libraryId) {
    const matchIndex = matches.findIndex((m) => m.routeId === '/_libraries')
    const match = matches[matchIndex + 1]
    if (match) {
      // Route ID format: /_libraries/query/$version/ -> split gives ['', '_libraries', 'query', '$version', '']
      libraryId = match.routeId.split('/')[2]
    }
  }

  const library = findLibrary(libraryId)

  return (
    <div
      className={twMerge(
        'fixed inset-0 z-0 pointer-events-none',
        'transition-opacity duration-[2s] ease-linear',
        'bg-radial',
        'to-transparent',
        ...(library?.bgRadial
          ? [library.bgRadial]
          : [
              'from-gray-300 via-gray-300/50',
              'dark:from-gray-300 dark:via-gray-300/30',
              'to-transparent',
            ]),
        'opacity-20 dark:opacity-20',
      )}
    />
  )
}
