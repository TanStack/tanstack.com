import { useLocalStorage } from '~/utils/useLocalStorage'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'
import { Link, useMatches } from '@tanstack/react-router'

export function RedirectVersionBanner(props: {
  version: string
  latestVersion: string
}) {
  const { version, latestVersion } = props

  const matches = useMatches()
  const activeMatch = matches[matches.length - 1]

  // After user clicks hide, do not show modal for a month, and then remind users that there is a new version!
  const [showModal, setShowModal] = useLocalStorage(
    'showRedirectToLatestModal',
    true,
    1000 * 60 * 24 * 30
  )

  if (!useClientOnlyRender()) {
    return null
  }

  if (![latestVersion, 'latest'].includes(version) && showModal) {
    return (
      <div className="p-4 bg-white/70 text-black dark:bg-gray-500/40 dark:text-white shadow-xl shadow-black/20 flex items-center justify-center gap-2.5 lg:gap-4 fixed top-4 left-1/2 bottom-auto backdrop-blur-sm z-100 -translate-x-1/2 rounded-3xl lg:rounded-full overflow-hidden w-[80%] lg:w-auto">
        <p className="block">
          You are currently reading <strong>{version}</strong> docs. Redirect to{' '}
          <Link
            to={activeMatch.fullPath}
            params={{
              version: 'latest',
            }}
            className="font-bold underline"
          >
            latest
          </Link>{' '}
          version?
        </p>
        <div className="flex gap-2 flex-col lg:flex-row items-center">
          <Link
            to={activeMatch.fullPath}
            params={{
              version: 'latest',
            }}
            replace
            className="bg-black dark:bg-white dark:text-black text-white w-full lg:w-auto py-1 px-2 rounded-md uppercase font-black text-xs"
          >
            Latest
          </Link>
          <button
            onClick={() => setShowModal(false)}
            className="bg-black dark:bg-white dark:text-black text-white w-full lg:w-auto py-1 px-2 rounded-md uppercase font-black text-xs"
          >
            Hide
          </button>
        </div>
      </div>
    )
  }

  return null
}
