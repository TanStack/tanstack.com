/**
 * Builder Provider (v2)
 *
 * Initializes the builder store and handles feature loading.
 * Uses proper theme support.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useBuilderStore } from './store'

interface BuilderContextValue {
  ready: boolean
}

const BuilderContext = createContext<BuilderContextValue>({ ready: false })

export function useBuilderContext() {
  return useContext(BuilderContext)
}

interface BuilderProviderProps {
  children: ReactNode
}

export function BuilderProvider({ children }: BuilderProviderProps) {
  const [ready, setReady] = useState(false)
  const loadFeatures = useBuilderStore((s) => s.loadFeatures)
  const featuresLoaded = useBuilderStore((s) => s.featuresLoaded)

  useEffect(() => {
    loadFeatures()
  }, [loadFeatures])

  useEffect(() => {
    if (featuresLoaded) {
      setReady(true)
    }
  }, [featuresLoaded])

  return (
    <BuilderContext.Provider value={{ ready }}>
      {ready ? children : <BuilderLoading />}
    </BuilderContext.Provider>
  )
}

function BuilderLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-cyan-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading builder...</p>
      </div>
    </div>
  )
}
