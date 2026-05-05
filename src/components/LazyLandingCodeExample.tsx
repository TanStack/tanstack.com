import { useQuery } from '@tanstack/react-query'
import type { LibraryId } from '~/libraries'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'
import { fetchLandingCodeExample } from '~/utils/landing-code-example.functions'

function LandingCodeExamplePlaceholder() {
  return (
    <div className="px-4 space-y-4 flex flex-col items-center">
      <div className="text-3xl font-black">Just a quick look...</div>
      <div className="w-full max-w-3xl min-w-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 animate-pulse">
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
          <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="space-y-3 p-4">
          <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  )
}

export function LazyLandingCodeExample({
  libraryId,
}: {
  libraryId: LibraryId
}) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '25%',
    triggerOnce: true,
  })
  const { data, isLoading } = useQuery({
    queryKey: ['landing-code-example', libraryId],
    queryFn: () =>
      fetchLandingCodeExample({
        data: {
          libraryId,
        },
      }),
    enabled: isIntersecting,
    staleTime: 5 * 60 * 1000,
  })

  if (isIntersecting && !isLoading && !data?.contentRsc) {
    return null
  }

  return (
    <div ref={ref}>
      {data?.contentRsc ? data.contentRsc : <LandingCodeExamplePlaceholder />}
    </div>
  )
}
