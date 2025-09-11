import * as React from 'react'
import { create } from 'zustand'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Select } from './Select'
import {
  Framework,
  getFrameworkOptions,
  getLibrary,
  LibraryId,
} from '~/libraries'

export function FrameworkSelect({ libraryId }: { libraryId: LibraryId }) {
  const library = getLibrary(libraryId)
  const frameworkConfig = useFrameworkConfig({ frameworks: library.frameworks })
  return (
    <Select
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
const useLocalCurrentFramework = create<{
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
 * Otherwise use framework in localStorage if it exists for this project
 * Otherwise fallback to react
 */
export function useCurrentFramework(frameworks: Framework[]) {
  const navigate = useNavigate()

  const { framework: paramsFramework } = useParams({
    strict: false,
  })

  const localCurrentFramework = useLocalCurrentFramework()

  let framework = (paramsFramework ||
    localCurrentFramework.currentFramework ||
    'react') as Framework

  framework = frameworks.includes(framework) ? framework : 'react'

  const setFramework = React.useCallback(
    (framework: string) => {
      navigate({
        params: (prev) => ({
          ...prev,
          framework,
        }),
      })
      localCurrentFramework.setCurrentFramework(framework)
    },
    [localCurrentFramework, navigate]
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
