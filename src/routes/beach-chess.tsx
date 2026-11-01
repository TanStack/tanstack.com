import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
// /beach-chess — a beach-themed chess game: you vs. the computer.

// Lazy load the game so the chess engine stays out of the main chunk.
const BeachChess = lazy(() => import('~/components/beach-chess/BeachChess'))

export const Route = createFileRoute('/beach-chess')({
  component: BeachChessPage,
  head: () => ({
    meta: [
      {
        title: 'Beach Chess | TanStack',
      },
      {
        name: 'description',
        content:
          'Play beach-themed chess against the computer — coconuts, dolphins and bikini queens vs. the tiki crew. Pick your difficulty and your master title.',
      },
    ],
  }),
  staticData: {
    // Self-contained full-screen game: hide the global TanStack navbar so its
    // links don't pull the player back out to the rest of the site.
    showNavbar: false,
  },
})

function LoadingScreen() {
  return (
    <div className="w-full h-[100dvh] bg-gradient-to-b from-[#cdeffd] via-[#eaf6e9] to-[#f6edd2] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
        <p className="text-slate-700 text-lg font-medium">Raking the sand…</p>
        <p className="text-slate-500 text-sm mt-2">Setting up the beach</p>
      </div>
    </div>
  )
}

function BeachChessPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BeachChess />
    </Suspense>
  )
}
