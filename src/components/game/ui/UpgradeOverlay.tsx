import { useEffect, useState } from 'react'
import { useGameStore } from '../hooks/useGameStore'

export function UpgradeOverlay() {
  const { phase, setPhase, setBoatType } = useGameStore()
  const [animationStep, setAnimationStep] = useState(0)

  useEffect(() => {
    if (phase !== 'upgrading') {
      setAnimationStep(0)
      return
    }

    // Animation sequence
    const timers = [
      setTimeout(() => setAnimationStep(1), 300),
      setTimeout(() => setAnimationStep(2), 800),
      setTimeout(() => setAnimationStep(3), 1300),
      setTimeout(() => setAnimationStep(4), 1800),
    ]

    return () => timers.forEach(clearTimeout)
  }, [phase])

  const handleContinue = () => {
    setBoatType('ship')
    setPhase('playing')
  }

  if (phase !== 'upgrading') return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-8">
      {/* Animated background */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: animationStep >= 1 ? 1 : 0,
          background:
            'radial-gradient(ellipse at center, rgba(6, 78, 117, 0.95) 0%, rgba(0, 0, 0, 0.98) 100%)',
        }}
      />

      {/* Content card */}
      <div
        className="relative z-10 max-w-lg w-full transition-all duration-500"
        style={{
          opacity: animationStep >= 1 ? 1 : 0,
          transform: animationStep >= 1 ? 'scale(1)' : 'scale(0.9)',
        }}
      >
        {/* Card with glass effect */}
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
          {/* Trophy/Star icon */}
          <div
            className="transition-all duration-500 mb-4"
            style={{
              opacity: animationStep >= 1 ? 1 : 0,
              transform: animationStep >= 1 ? 'scale(1)' : 'scale(0.5)',
            }}
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg">
              <svg
                className="w-10 h-10 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
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
            <h1 className="text-3xl font-bold text-white mb-2">
              All Libraries Discovered!
            </h1>
            <p className="text-cyan-300 text-sm uppercase tracking-wider font-medium">
              Exploration Complete
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

          {/* Upgrade info */}
          <div
            className="transition-all duration-500 space-y-4"
            style={{
              opacity: animationStep >= 3 ? 1 : 0,
              transform:
                animationStep >= 3 ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <div className="flex items-center justify-center gap-3 text-white">
              <span className="text-2xl">🚣</span>
              <span className="text-gray-400">→</span>
              <span className="text-2xl">🚢</span>
            </div>
            <p className="text-white text-lg">
              Your rowboat has been upgraded to a{' '}
              <span className="text-cyan-400 font-semibold">Battle Ship</span>
            </p>

            <div className="flex flex-wrap justify-center gap-3 mt-4">
              <div className="px-3 py-1.5 rounded-full bg-white/10 text-sm text-gray-200">
                Expanded World
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/10 text-sm text-gray-200">
                Side Cannons
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/10 text-sm text-gray-200">
                Partner Islands
              </div>
            </div>

            <p className="text-gray-400 text-sm mt-4">
              Press{' '}
              <kbd className="px-2 py-0.5 rounded bg-white/20 text-white font-mono">
                SPACE
              </kbd>{' '}
              to fire cannons
            </p>
          </div>

          {/* Button */}
          <div
            className="mt-8 transition-all duration-500"
            style={{
              opacity: animationStep >= 4 ? 1 : 0,
              transform:
                animationStep >= 4 ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <button
              onClick={handleContinue}
              className="w-full py-3 px-6 rounded-xl font-semibold text-lg text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)',
              }}
            >
              Set Sail!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
