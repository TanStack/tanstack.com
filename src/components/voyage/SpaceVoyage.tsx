// Main Space Voyage component for /voyage.
// A flying star-galleon explores TanStack libraries scattered across three
// altitude "dimensions" — a spacefaring cousin of the Island Explorer.

import { useState } from 'react'
import { VoyageScene } from './VoyageScene'
import { VoyageHUD } from './ui/VoyageHUD'
import type { VoyageEngine } from './engine/VoyageEngine'

const LOADING_MESSAGES = [
  ['Hoisting the solar sails...', 'Mind the cosmic wind'],
  ['Charting the star lanes...', 'X marks the nebula'],
  ['Waking the stardust crew...', 'They sleep in zero-g'],
  ['Tuning the dimension drive...', 'High, low, and in between'],
  ['Polishing the brass telescope...', 'For spotting distant worlds'],
  ['Counting the constellations...', 'We lost count at infinity'],
  ['Feeding the ship cat...', 'Even pirates need a navigator'],
  ['Calibrating the gravity anchor...', 'Down is relative out here'],
]

function LoadingOverlay() {
  const [messageIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGES.length),
  )
  const [headline, subtext] = LOADING_MESSAGES[messageIndex]

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0820] via-[#070a1a] to-black flex items-center justify-center z-50">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-cyan-300 rounded-full animate-spin" />
        <p className="text-white text-lg font-medium">{headline}</p>
        <p className="text-white/50 text-sm mt-2">{subtext}</p>
      </div>
    </div>
  )
}

export default function SpaceVoyage() {
  const [isLoading, setIsLoading] = useState(true)
  const [engine, setEngine] = useState<VoyageEngine | null>(null)

  return (
    <div className="relative w-full h-[calc(100dvh-var(--navbar-height))] bg-black overflow-hidden">
      {isLoading && <LoadingOverlay />}

      {/* 3D scene */}
      <div className="absolute inset-0">
        <VoyageScene onLoadingChange={setIsLoading} onEngineReady={setEngine} />
      </div>

      {/* Vignette for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,10,0.55) 100%)',
        }}
      />

      {!isLoading && <VoyageHUD engine={engine} />}
    </div>
  )
}
