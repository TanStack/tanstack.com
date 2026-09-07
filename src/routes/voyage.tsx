import { Link, createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
// /voyage — space-flight cousin of /explore

// Lazy load the whole experience to keep the Three.js bundle out of the main chunk.
const SpaceVoyage = lazy(() => import('~/components/voyage/SpaceVoyage'))

export const Route = createFileRoute('/voyage')({
  component: VoyagePage,
  head: () => ({
    meta: [
      {
        title: 'Space Voyage | TanStack',
      },
      {
        name: 'description',
        content:
          'Captain a flying star-galleon through three dimensions of deep space to discover every TanStack library in this fun 3D voyage.',
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
          Voyage
        </Link>
      )
    },
  },
})

function LoadingScreen() {
  return (
    <div className="w-full h-[calc(100dvh-var(--navbar-height))] bg-gradient-to-b from-[#0a0820] via-[#070a1a] to-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-cyan-300 rounded-full animate-spin" />
        <p className="text-white text-lg font-medium">Charting the stars...</p>
        <p className="text-white/50 text-sm mt-2">Loading voyage engine</p>
      </div>
    </div>
  )
}

function VoyagePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SpaceVoyage />
    </Suspense>
  )
}
