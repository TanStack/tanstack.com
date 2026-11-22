import * as React from 'react'
import { createStore, useSelector } from '@tanstack/react-store'
import { useNavigate, useParams } from '@tanstack/react-router'
import { TagIcon } from '@phosphor-icons/react/Tag'
import { Select, SelectOption } from './Select'
import { getLibrary, LibraryId } from '~/libraries'
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '~/utils/browser-storage'

export function VersionSelect({ libraryId }: { libraryId: LibraryId }) {
  const library = getLibrary(libraryId)
  const versionConfig = useVersionConfig({
    versions: library.availableVersions,
    latestVersion: library.latestVersion,
  })
  return (
    <Select
      className="w-full"
      icon={<TagIcon className="w-3.5 h-3.5 opacity-60" />}
      selected={versionConfig.selected}
      available={versionConfig.available}
      onSelect={versionConfig.onSelect}
    />
  )
}

// Let's use TanStack Store to wrap the local storage logic. This way
// we'll get subscriptions for free and we can use it in other
// components if we need to.
const localCurrentVersionStore = createStore(
  { currentVersion: getLocalStorageItem('version') || undefined },
  ({ setState }) => ({
    setCurrentVersion: (version: string) => {
      setLocalStorageItem('version', version)
      setState(() => ({ currentVersion: version }))
    },
  }),
)

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

  const localCurrentVersion = useSelector(
    localCurrentVersionStore,
    (s) => s.currentVersion,
  )
  const { setCurrentVersion } = localCurrentVersionStore.actions

  let version = paramsVersion || localCurrentVersion || 'latest'

  version = versions.includes(version) ? version : 'latest'

  const setVersion = React.useCallback(
    (version: string) => {
      navigate({
        params: { version } as never,
      })
      setCurrentVersion(version)
    },
    [navigate, setCurrentVersion],
  )

  React.useEffect(() => {
    // Set the version in localStorage if it doesn't exist
    if (!localCurrentVersion) {
      setCurrentVersion(version)
    }

    // Set the version in localStorage if it doesn't match the URL
    if (paramsVersion && paramsVersion !== localCurrentVersion) {
      setCurrentVersion(paramsVersion)
    }
  })

  return {
    version,
    setVersion,
  }
}

function useVersionConfig({
  versions,
  latestVersion,
}: {
  versions: string[]
  latestVersion: string
}) {
  const currentVersion = useCurrentVersion(versions)

  const versionConfig = React.useMemo(() => {
    // The latest numbered version and 'latest' are the same docs, so they
    // collapse into a single option that navigates to the /latest URL.
    const available = versions.map(
      (version): SelectOption =>
        version === latestVersion
          ? { label: version, value: 'latest', badge: 'Latest' }
          : { label: version, value: version },
    )

    const isLatest =
      currentVersion.version === latestVersion ||
      !versions.includes(currentVersion.version)

    return {
      label: 'Version',
      selected: isLatest ? 'latest' : currentVersion.version,
      available,
      onSelect: (option: { label: string; value: string }) => {
        currentVersion.setVersion(option.value)
      },
    }
  }, [currentVersion, versions, latestVersion])

  return versionConfig
}
