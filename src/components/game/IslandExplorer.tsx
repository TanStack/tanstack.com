// Main Island Explorer game component
// This file imports R3F/Drei dependencies - only loaded when route is accessed

import { GameScene } from './scene/GameScene'
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

export default function IslandExplorer() {
  return (
    <div className="relative w-full h-[calc(100dvh-var(--navbar-height))] bg-sky-500">
      {/* 3D Scene */}
      <div className="absolute inset-0">
        <GameScene />
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
      <Minimap />
      <IslandIndicator />
      <CompassIndicator />
      <TouchControls />
      <Shop />
      <DebugPanel />
    </div>
  )
}
