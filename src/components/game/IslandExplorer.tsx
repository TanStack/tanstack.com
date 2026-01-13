// Main Island Explorer game component
// Uses vanilla Three.js engine for better performance

import { useState } from 'react'
import { VanillaGameScene } from './scene/VanillaGameScene'
import { IntroOverlay } from './ui/IntroOverlay'
import { GameHUD } from './ui/GameHUD'
import { TouchControls } from './ui/TouchControls'
import { CompleteOverlay } from './ui/CompleteOverlay'
import { UpgradeOverlay } from './ui/UpgradeOverlay'
import { Minimap } from './ui/Minimap'
import { DebugPanel } from './ui/DebugPanel'
import { IslandIndicator } from './ui/IslandIndicator'
import { Shop } from './ui/Shop'
import { CompassIndicator } from './ui/CompassIndicator'
import { GameOverOverlay } from './ui/GameOverOverlay'
import { StatsHUD } from './ui/StatsHUD'

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-cyan-600 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-white text-lg font-medium">Loading assets...</p>
        <p className="text-white/60 text-sm mt-2">
          Preparing ocean, boats, and islands
        </p>
      </div>
    </div>
  )
}

export default function IslandExplorer() {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className="relative w-full h-[calc(100dvh-var(--navbar-height))] bg-sky-500">
      {/* Loading overlay */}
      {isLoading && <LoadingOverlay />}

      {/* 3D Scene */}
      <div className="absolute inset-0">
        <VanillaGameScene onLoadingChange={setIsLoading} />
      </div>

      {/* Vignette overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,20,40,0.3) 100%)',
        }}
      />

      {/* UI Overlays */}
      <IntroOverlay />
      <UpgradeOverlay />
      <CompleteOverlay />
      <GameOverOverlay />
      <GameHUD />
      <StatsHUD />
      <Minimap />
      <IslandIndicator />
      <CompassIndicator />
      <TouchControls />
      <Shop />
      <DebugPanel />
    </div>
  )
}
