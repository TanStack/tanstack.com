import * as React from 'react'
import { create } from 'zustand'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Select } from './Select'
import { Framework, getLibrary, LibraryId } from '~/libraries'
import { getFrameworkOptions } from '~/libraries/frameworks'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { updateLastUsedFramework } from '~/utils/users.server'

export function FrameworkSelect({ libraryId }: { libraryId: LibraryId }) {
  const library = getLibrary(libraryId)
  const frameworkConfig = useFrameworkConfig({
    frameworks: library.frameworks,
  })
  return (
    <Select
      className="min-w-[120px]"
      label={frameworkConfig.label}
      selected={frameworkConfig.selected}
      available={frameworkConfig.available}
      onSelect={frameworkConfig.onSelect}
    />
  )
}

// Let's use zustand to wrap the local storage logic. This way
// we'll get subscriptions for free and we can use it in other
// components if we need to.
export const useLocalCurrentFramework = create<{
  currentFramework?: string
  setCurrentFramework: (framework: string) => void
}>((set) => ({
  currentFramework:
    typeof document !== 'undefined'
      ? localStorage.getItem('framework') || undefined
      : undefined,
  setCurrentFramework: (framework: string) => {
    localStorage.setItem('framework', framework)
    set({ currentFramework: framework })
  },
}))

/**
 * Get the stored framework preference from localStorage.
 * Safe to call during SSR (returns undefined).
 */
export function getStoredFrameworkPreference(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem('framework') || undefined
}

/**
 * Hook to persist framework preference.
 * Saves to localStorage always, and to DB if user is logged in.
 */
export function usePersistFrameworkPreference() {
  const userQuery = useCurrentUserQuery()
  const localCurrentFramework = useLocalCurrentFramework()

  return React.useCallback(
    (framework: string) => {
      // Always update localStorage as fallback
      localCurrentFramework.setCurrentFramework(framework)
      // Update DB for logged-in users (fire-and-forget)
      if (userQuery.data) {
        updateLastUsedFramework({ data: { framework } }).catch(() => {
          // Silently ignore errors - localStorage is the fallback
        })
      }
    },
    [localCurrentFramework, userQuery.data],
  )
}

function useFrameworkConfig({ frameworks }: { frameworks: Framework[] }) {
  const currentFramework = useCurrentFramework(frameworks)

  const frameworkConfig = React.useMemo(() => {
    return {
      label: 'Framework',
      selected: frameworks.includes(currentFramework.framework)
        ? currentFramework.framework
        : 'react',
      available: getFrameworkOptions(frameworks),
      onSelect: (option: { label: string; value: string }) => {
        currentFramework.setFramework(option.value)
      },
    }
  }, [frameworks, currentFramework])

  return frameworkConfig
}

/**
 * Use framework in URL path
 * Otherwise use framework from user's DB preference (if logged in)
 * Otherwise use framework in localStorage if it exists for this project
 * Otherwise fallback to react
 */
export function useCurrentFramework(frameworks: Framework[]) {
  const navigate = useNavigate()
  const userQuery = useCurrentUserQuery()

  const { framework: paramsFramework } = useParams({
    strict: false,
  })

  const localCurrentFramework = useLocalCurrentFramework()

  // Priority: URL params > DB (logged-in) > localStorage > 'react'
  const userFramework = userQuery.data?.lastUsedFramework
  let framework = (paramsFramework ||
    userFramework ||
    localCurrentFramework.currentFramework ||
    'react') as Framework

  framework = frameworks.includes(framework) ? framework : 'react'

  const setFramework = React.useCallback(
    (framework: string) => {
      navigate({
        params: { framework } as any,
      })
      // Always update localStorage as fallback
      localCurrentFramework.setCurrentFramework(framework)
      // Update DB for logged-in users (fire-and-forget)
      if (userQuery.data) {
        updateLastUsedFramework({ data: { framework } }).catch(() => {
          // Silently ignore errors - localStorage is the fallback
        })
      }
    },
    [localCurrentFramework, navigate, userQuery.data],
  )

  React.useEffect(() => {
    // Set the framework in localStorage if it doesn't exist
    if (!localCurrentFramework.currentFramework) {
      localCurrentFramework.setCurrentFramework(framework)
    }

    // Set the framework in localStorage if it doesn't match the URL
    if (
      paramsFramework &&
      paramsFramework !== localCurrentFramework.currentFramework
    ) {
      localCurrentFramework.setCurrentFramework(paramsFramework)
    }
  })

  return {
    framework,
    setFramework,
  }
}
