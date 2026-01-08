import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

// Lazy load the entire game to keep it out of main bundle
const IslandExplorer = lazy(() => import('~/components/game/IslandExplorer'))

export const Route = createFileRoute('/_libraries/explore')({
  component: ExplorePage,
  head: () => ({
    meta: [
      {
        title: 'Island Explorer | TanStack',
      },
      {
        name: 'description',
        content:
          'Sail between islands to discover TanStack libraries in this fun 3D exploration game.',
      },
    ],
  }),
  staticData: {
    Title: () => {
      return (
        <Link
          to="."
          className="hover:text-blue-500 flex items-center gap-2 text-gray-500"
        >
          Explore
        </Link>
      )
    },
  },
})

// Loading screen while game assets load
// TODO: Upgrade to themed loading screen with island silhouette
function LoadingScreen() {
  return (
    <div className="w-full h-[calc(100dvh-var(--navbar-height))] bg-gradient-to-b from-sky-400 to-cyan-600 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-white text-lg font-medium">
          Preparing your voyage...
        </p>
      </div>
    </div>
  )
}

function ExplorePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <IslandExplorer />
    </Suspense>
  )
}
