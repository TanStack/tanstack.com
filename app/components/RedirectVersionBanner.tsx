import { Link, useLocation } from '@remix-run/react'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'

export function RedirectVersionBanner(props: {
  currentVersion: string
  latestVersion: string
}) {
  const location = useLocation()

  // After user clicks hide, do not show modal for a month, and then remind users that there is a new version!
  const [showModal, setShowModal] = useLocalStorage(
    'showRedirectToLatestModal',
    true,
    1000 * 60 * 24 * 30
  )

  const isLowerVersion =
    Number(props.currentVersion) < Number(props.latestVersion[1])
  const redirectTarget = location.pathname.replace(
    `v${props.currentVersion}`,
    'latest'
  )

  if (!useClientOnlyRender()) {
    return null
  }

  return (
    <>
      {isLowerVersion && showModal ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            You are currently reading <strong>v{props.currentVersion}</strong>{' '}
            docs. Redirect to{' '}
            <a href={redirectTarget} className="font-bold underline">
              latest
            </a>{' '}
            version?
          </div>
          <Link
            to={redirectTarget}
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
      ) : null}
    </>
  )
}
