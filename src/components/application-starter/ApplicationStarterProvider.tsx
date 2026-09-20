/**
 * ApplicationStarter Provider (v2)
 *
 * Initializes the application starter store and handles feature loading.
 * Uses proper theme support.
 */

import {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSearch } from '@tanstack/react-router'
import { useApplicationStarterStore } from './store'
import { normalizeFrameworkId } from '~/application-starter/frameworks'

interface ApplicationStarterContextValue {
  ready: boolean
}

const ApplicationStarterContext = createContext<ApplicationStarterContextValue>(
  { ready: false },
)

interface ApplicationStarterProviderProps {
  children: ReactNode
}

export function ApplicationStarterProvider({
  children,
}: ApplicationStarterProviderProps) {
  const [ready, setReady] = useState(false)
  const search = useSearch({ strict: false }) as { framework?: string }
  const loadFeatures = useApplicationStarterStore((s) => s.loadFeatures)
  const featuresLoaded = useApplicationStarterStore((s) => s.featuresLoaded)
  const initializedRef = useRef(false)

  // Set framework from URL before loading features (only once on mount)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    // Set framework directly in store without triggering loadFeatures
    if (search.framework) {
      useApplicationStarterStore.setState({
        framework: normalizeFrameworkId(search.framework),
      })
    }
    loadFeatures()
  }, [loadFeatures, search.framework])

  useEffect(() => {
    if (featuresLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true)
    }
  }, [featuresLoaded])

  return (
    <ApplicationStarterContext.Provider value={{ ready }}>
      {ready ? children : <ApplicationStarterLoading />}
    </ApplicationStarterContext.Provider>
  )
}

function ApplicationStarterLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-cyan-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          Loading application starter...
        </p>
      </div>
    </div>
  )
}
