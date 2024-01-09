import { IoIosClose } from 'react-icons/io'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'

export function QueryGGBanner() {
  const [hidden, setHidden] = useLocalStorage('pppbanner-hidden', false)

  if (!useClientOnlyRender()) {
    return null
  }

  return (
    <>
      {!hidden && (
        <div className="w-full bg-gradient-to-r from-red-500 to-amber-500 text-black text-sm text-center py-2 relative flex items-center justify-center">
          <p>
            Want to <span className="italic">skip the docs?</span> Check out{' '}
            <a href="https://query.gg?s=tanstack">
              <strong>query.gg</strong>
            </a>{' '}
            – the simplest way to master React Query.
          </p>
          <button
            onClick={() => setHidden(true)}
            className="absolute right-0"
            aria-label="Hide Banner"
          >
            <IoIosClose size={30} className="text-black" />
          </button>
        </div>
      )}
    </>
  )
}
