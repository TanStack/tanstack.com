import * as React from 'react'
import { create } from 'zustand'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Select, SelectOption } from './Select'
import { getLibrary, LibraryId } from '~/libraries'

export function VersionSelect({ libraryId }: { libraryId: LibraryId }) {
  const library = getLibrary(libraryId)
  const versionConfig = useVersionConfig({
    versions: library.availableVersions,
  })
  return (
    <Select
      label={versionConfig.label}
      selected={versionConfig.selected}
      available={versionConfig.available}
      onSelect={versionConfig.onSelect}
    />
  )
}

// Let's use zustand to wrap the local storage logic. This way
// we'll get subscriptions for free and we can use it in other
// components if we need to.
const useLocalCurrentVersion = create<{
  currentVersion?: string
  setCurrentVersion: (version: string) => void
}>((set) => ({
  currentVersion:
    typeof document !== 'undefined'
      ? localStorage.getItem('version') || undefined
      : undefined,
  setCurrentVersion: (version: string) => {
    localStorage.setItem('version', version)
    set({ currentVersion: version })
  },
}))

/**
 * Use framework in URL path
 * Otherwise use framework in localStorage if it exists for this project
 * Otherwise fallback to react
 */
function useCurrentVersion(versions: string[]) {
  const navigate = useNavigate()

  const { version: paramsVersion } = useParams({
    strict: false,
  })

  const localCurrentVersion = useLocalCurrentVersion()

  let version = paramsVersion || localCurrentVersion.currentVersion || 'latest'

  version = versions.includes(version) ? version : 'latest'

  const setVersion = React.useCallback(
    (version: string) => {
      navigate({
        params: (prev: Record<string, string>) => ({
          ...prev,
          version,
        }),
      })
      localCurrentVersion.setCurrentVersion(version)
    },
    [localCurrentVersion, navigate]
  )

  React.useEffect(() => {
    // Set the version in localStorage if it doesn't exist
    if (!localCurrentVersion.currentVersion) {
      localCurrentVersion.setCurrentVersion(version)
    }

    // Set the version in localStorage if it doesn't match the URL
    if (paramsVersion && paramsVersion !== localCurrentVersion.currentVersion) {
      localCurrentVersion.setCurrentVersion(paramsVersion)
    }
  })

  return {
    version,
    setVersion,
  }
}

function useVersionConfig({ versions }: { versions: string[] }) {
  const currentVersion = useCurrentVersion(versions)

  const versionConfig = React.useMemo(() => {
    const available = versions.reduce(
      (acc: SelectOption[], version) => {
        acc.push({
          label: version,
          value: version,
        })
        return acc
      },
      [
        {
          label: 'Latest',
          value: 'latest',
        },
      ]
    )

    return {
      label: 'Version',
      selected: versions.includes(currentVersion.version)
        ? currentVersion.version
        : 'latest',
      available,
      onSelect: (option: { label: string; value: string }) => {
        currentVersion.setVersion(option.value)
      },
    }
  }, [currentVersion, versions])

  return versionConfig
}
