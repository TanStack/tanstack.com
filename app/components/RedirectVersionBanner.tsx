import { Link } from '@remix-run/react'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'

export function RedirectVersionBanner(props: {
  version: string
  latestVersion: string
  redirectUrl: string
}) {
  const { version, latestVersion, redirectUrl } = props

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
          <a href={redirectUrl} className="font-bold underline">
            latest
          </a>{' '}
          version?
        </div>
        <Link
          to={redirectUrl}
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
