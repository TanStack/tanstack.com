import { useEffect, useState } from 'react'
import { useGameStore } from '../hooks/useGameStore'
import {
  Compass,
  Volume2,
  VolumeX,
  Map,
  Coins,
  ShoppingBag,
} from 'lucide-react'

export function GameHUD() {
  const {
    phase,
    stage,
    discoveredIslands,
    islands,
    expandedIslands,
    boatRotation,
    coinsCollected,
    isMuted,
    toggleMute,
    boatHealth,
    shipStats,
    lastFireTime,
    lastUnlockedUpgrade,
    clearLastUnlockedUpgrade,
    openShop,
    setPhase,
  } = useGameStore()

  // Cooldown progress (0-1, 1 = ready)
  const [cooldownProgress, setCooldownProgress] = useState(1)
  const [showUpgradeNotification, setShowUpgradeNotification] = useState(false)
  const [showCoinHint, setShowCoinHint] = useState(false)
  const [coinHintDismissed, setCoinHintDismissed] = useState(false)

  // Update cooldown progress
  useEffect(() => {
    if (stage !== 'battle') return
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastFireTime
      const progress = Math.min(1, elapsed / shipStats.sideFireRate)
      setCooldownProgress(progress)
    }, 50)
    return () => clearInterval(interval)
  }, [stage, lastFireTime, shipStats.sideFireRate])

  // Show upgrade notification when new upgrade unlocked
  useEffect(() => {
    if (lastUnlockedUpgrade) {
      setShowUpgradeNotification(true)
      const timer = setTimeout(() => {
        setShowUpgradeNotification(false)
        clearLastUnlockedUpgrade()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [lastUnlockedUpgrade, clearLastUnlockedUpgrade])

  // Show coin hint on first coin collected
  useEffect(() => {
    if (coinsCollected === 1 && !coinHintDismissed) {
      setShowCoinHint(true)
      const timer = setTimeout(() => {
        setShowCoinHint(false)
        setCoinHintDismissed(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [coinsCollected, coinHintDismissed])

  // Check for game over when health drops to 0
  useEffect(() => {
    if (stage === 'battle' && phase === 'playing' && boatHealth <= 0) {
      setPhase('gameover')
    }
  }, [stage, phase, boatHealth, setPhase])

  // Total islands depends on stage
  const totalIslands =
    stage === 'battle'
      ? islands.length + expandedIslands.length
      : islands.length

  if (phase !== 'playing') return null

  // Convert rotation to compass direction
  const getCompassDirection = (rotation: number) => {
    // Normalize to 0-360
    const degrees = ((rotation * 180) / Math.PI + 360) % 360

    if (degrees >= 337.5 || degrees < 22.5) return 'N'
    if (degrees >= 22.5 && degrees < 67.5) return 'NW'
    if (degrees >= 67.5 && degrees < 112.5) return 'W'
    if (degrees >= 112.5 && degrees < 157.5) return 'SW'
    if (degrees >= 157.5 && degrees < 202.5) return 'S'
    if (degrees >= 202.5 && degrees < 247.5) return 'SE'
    if (degrees >= 247.5 && degrees < 292.5) return 'E'
    if (degrees >= 292.5 && degrees < 337.5) return 'NE'
    return 'N'
  }

  // lastUnlockedUpgrade is now the full Upgrade object
  const upgradeInfo = lastUnlockedUpgrade

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* Coin hint */}
      {showCoinHint && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-center text-white text-sm max-w-xs">
            <span className="text-yellow-400 font-medium">Coins</span> make you
            faster and can be spent in the{' '}
            <span className="text-yellow-400 font-medium">shop</span>!
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex justify-between items-start p-4">
        {/* Compass */}
        <div className="pointer-events-auto bg-black/30 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 text-white">
          <Compass className="w-5 h-5" />
          <span className="font-mono font-bold text-lg w-8">
            {getCompassDirection(boatRotation)}
          </span>
        </div>

        {/* Coin counter + Shop button */}
        <button
          onClick={openShop}
          className="pointer-events-auto bg-black/30 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 text-white hover:bg-black/40 transition-colors"
        >
          <Coins className="w-5 h-5 text-yellow-400" />
          <span className="font-bold text-yellow-400">{coinsCollected}</span>
          <ShoppingBag className="w-4 h-4 ml-1 text-white/60" />
        </button>

        {/* Island counter */}
        <div className="pointer-events-auto bg-black/30 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 text-white">
          <Map className="w-5 h-5" />
          <span className="font-bold">
            {discoveredIslands.size} / {totalIslands}
          </span>
          <span className="text-white/60 text-sm hidden sm:inline">
            islands
          </span>
        </div>

        {/* Mute button */}
        <button
          onClick={toggleMute}
          className="pointer-events-auto bg-black/30 backdrop-blur-sm rounded-xl p-2 text-white hover:bg-black/40 transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Bottom bar - Battle stage only */}
      {stage === 'battle' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          {/* Health bar */}
          <div className="bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
            <span className="text-red-400 text-sm font-medium">HP</span>
            <div className="w-32 h-3 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-200"
                style={{
                  width: `${(boatHealth / shipStats.maxHealth) * 100}%`,
                }}
              />
            </div>
            <span className="text-white text-sm font-mono w-12">
              {Math.round(boatHealth)}/{shipStats.maxHealth}
            </span>
          </div>

          {/* Cooldown gauge */}
          <div className="bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
            <span className="text-cyan-400 text-sm font-medium">CANNON</span>
            <div className="w-24 h-2 bg-black/50 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  cooldownProgress >= 1
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-300'
                    : 'bg-gradient-to-r from-cyan-800 to-cyan-600'
                }`}
                style={{ width: `${cooldownProgress * 100}%` }}
              />
            </div>
            <span className="text-white/60 text-xs w-12">
              {cooldownProgress >= 1 ? 'READY' : 'LOADING'}
            </span>
          </div>
        </div>
      )}

      {/* Upgrade notification */}
      {showUpgradeNotification && upgradeInfo && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in duration-300">
          <div className="bg-gradient-to-br from-yellow-500/90 to-amber-600/90 backdrop-blur-md rounded-2xl px-8 py-5 text-center shadow-2xl border border-yellow-300/30">
            <div className="text-4xl mb-2">{upgradeInfo.icon}</div>
            <div className="text-white font-bold text-xl mb-1">
              {upgradeInfo.name}
            </div>
            <div className="text-yellow-100/80 text-sm">
              {upgradeInfo.description}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
