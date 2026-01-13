import { useEffect, useState } from 'react'
import { useGameStore } from '../hooks/useGameStore'

export function WinOverlay() {
  const { gameWon } = useGameStore()
  const [animationStep, setAnimationStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!gameWon) {
      setAnimationStep(0)
      setDismissed(false)
      return
    }

    if (dismissed) return

    const timers = [
      setTimeout(() => setAnimationStep(1), 300),
      setTimeout(() => setAnimationStep(2), 800),
      setTimeout(() => setAnimationStep(3), 1300),
      setTimeout(() => setAnimationStep(4), 1800),
    ]

    return () => timers.forEach(clearTimeout)
  }, [gameWon, dismissed])

  if (!gameWon || dismissed) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-8">
      {/* Background */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: animationStep >= 1 ? 1 : 0,
          background:
            'radial-gradient(ellipse at center, rgba(20, 80, 60, 0.95) 0%, rgba(0, 0, 0, 0.98) 100%)',
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 max-w-lg w-full transition-all duration-500"
        style={{
          opacity: animationStep >= 1 ? 1 : 0,
          transform: animationStep >= 1 ? 'scale(1)' : 'scale(0.9)',
        }}
      >
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Icon */}
          <div
            className="transition-all duration-500 mb-4"
            style={{
              opacity: animationStep >= 1 ? 1 : 0,
              transform: animationStep >= 1 ? 'scale(1)' : 'scale(0.5)',
            }}
          >
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
              <span className="text-5xl">🏆</span>
            </div>
          </div>

          {/* Title */}
          <div
            className="transition-all duration-500"
            style={{
              opacity: animationStep >= 2 ? 1 : 0,
              transform:
                animationStep >= 2 ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <h1 className="text-4xl font-bold text-white mb-2">Victory!</h1>
            <p className="text-yellow-300 text-sm uppercase tracking-wider font-medium">
              You conquered all four corners!
            </p>
          </div>

          {/* Divider */}
          <div
            className="my-6 h-px transition-all duration-500"
            style={{
              opacity: animationStep >= 2 ? 0.3 : 0,
              background:
                'linear-gradient(90deg, transparent, white, transparent)',
            }}
          />

          {/* Message */}
          <div
            className="transition-all duration-500"
            style={{
              opacity: animationStep >= 3 ? 1 : 0,
              transform:
                animationStep >= 3 ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <p className="text-gray-300 text-sm mb-2">
              You've defeated all four corner bosses and captured their islands.
            </p>
            <p className="text-gray-400 text-xs mb-6">
              You are the ultimate TanStack explorer!
            </p>
          </div>

          {/* Button */}
          <div
            className="transition-all duration-500"
            style={{
              opacity: animationStep >= 4 ? 1 : 0,
              transform:
                animationStep >= 4 ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <button
              onClick={() => setDismissed(true)}
              className="w-full py-3 px-6 rounded-xl font-semibold text-lg text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)',
              }}
            >
              Continue Exploring
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
