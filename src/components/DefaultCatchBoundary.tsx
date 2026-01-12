import {
  ErrorComponent,
  ErrorComponentProps,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import * as Sentry from '@sentry/tanstackstart-react'

import { Button } from './Button'
import { useEffect } from 'react'

// type DefaultCatchBoundaryType = {
//   status: number
//   statusText: string
//   data: string
//   isRoot?: boolean
// }

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('error loading dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.name === 'ChunkLoadError'
  )
}

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()

  useEffect(() => {
    // Handle chunk loading errors (version skew) by reloading the page
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      const reloadKey = 'chunk-error-reload'
      const lastReload = sessionStorage.getItem(reloadKey)
      const now = Date.now()

      // Only reload if we haven't reloaded in the last 10 seconds (prevent loop)
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(reloadKey, now.toString())
        window.location.reload()
        return
      }
    }

    Sentry.captureException(error)
  }, [error])

  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  console.error(error)

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="opacity-10 flex flex-col text-center font-black">
        {/* <div className="text-7xl leading-none">{status}</div>
        {statusText ? (
          <div className="text-3xl leading-none">{statusText}</div>
        ) : null} */}
      </h1>
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          onClick={() => {
            router.invalidate()
          }}
          className="bg-gray-600 border-gray-600 hover:bg-gray-700 text-white"
        >
          Try Again
        </Button>
        {isRoot ? (
          <Button
            as={Link}
            to="/"
            className="bg-gray-600 border-gray-600 hover:bg-gray-700 text-white"
          >
            TanStack Home
          </Button>
        ) : (
          <Button
            as={Link}
            to="/"
            className="bg-gray-600 border-gray-600 hover:bg-gray-700 text-white"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault()
              window.history.back()
            }}
          >
            Go Back
          </Button>
        )}
      </div>
    </div>
  )
}
