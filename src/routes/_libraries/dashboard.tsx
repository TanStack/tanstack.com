import { useState, useEffect } from 'react'
import { FaArrowRight } from 'react-icons/fa'
import { PiHandWavingLight } from 'react-icons/pi'

export const Route = createFileRoute({
  component: Dashboard,
})

function Dashboard() {
  const [waved, setWaved] = useState(false)
  useEffect(() => {
    // Trigger wave on mount once
    setWaved(true)
  }, [])

  return (
    <div className="min-h-screen ">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center w-fit">
          <style>{`
          @keyframes hand-wave {
            0% { transform: rotate(0deg); }
            20% { transform: rotate(12deg); }
            50% { transform: rotate(-8deg); }
            80% { transform: rotate(6deg); }
            100% { transform: rotate(0deg); }
          }
        `}</style>
          <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] mx-auto max-w-sm">
            <div className="flex text-2xl items-center justify-center w-48 h-48 mx-auto">
              <div
                style={{
                  transformOrigin: '80% 90%',
                  animation: waved ? 'hand-wave 1s ease-in-out 1' : undefined,
                }}
              >
                <PiHandWavingLight className="w-24 h-24 text-yellow-500 rounded-full" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 text-center">
              Welcome!
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
              There's not much to see here yet. <br /> We're working on it!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-16">
              <a
                href="/account"
                className="inline-block bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/90 dark:hover:bg-white font-semibold py-2 px-6 rounded-md transition-colors text-center"
              >
                Account Settings
                <FaArrowRight className="inline-block ml-2" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
