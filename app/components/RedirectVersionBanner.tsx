import { useLocalStorage } from '~/utils/useLocalStorage'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'
import { Link } from '@tanstack/react-router'

export function RedirectVersionBanner(props: {
  version: string
  latestVersion: string
}) {
  const { version, latestVersion } = props

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
      <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
        <div>
          You are currently reading <strong>{version}</strong> docs. Redirect to{' '}
          <Link
            params={{
              version: 'latest',
            }}
            className="font-bold underline"
          >
            latest
          </Link>{' '}
          version?
        </div>
        <Link
          params={{
            version: 'latest',
          }}
          replace
          className="bg-white text-black py-1 px-2 rounded-md uppercase font-black text-xs"
        >
          Latest
        </Link>
        <button
          onClick={() => setShowModal(false)}
          className="bg-white text-black py-1 px-2 rounded-md uppercase font-black text-xs"
        >
          Hide
        </button>
      </div>
    )
  }
}
