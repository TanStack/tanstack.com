import useBytesSubmit from '~/components/useBytesSubmit'
import bytesImage from '~/images/bytes.svg'
import { useToast } from '~/components/ToastProvider'
import { useEffect } from 'react'

export default function BytesForm() {
  const { state, handleSubmit, error } = useBytesSubmit()
  const { notify } = useToast()
  useEffect(() => {
    if (state === 'submitted') {
      notify(
        <div>
          <div className="font-medium">Thanks for subscribing</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Check your email to confirm your subscription
          </div>
        </div>
      )
    }
  }, [state, notify])

  useEffect(() => {
    if (error) {
      notify(
        <div>
          <div className="font-medium">Subscription failed</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Please try again in a moment
          </div>
        </div>
      )
    }
  }, [error, notify])
  if (state === 'submitted') {
    return (
      <p>Success! Please, check your email to confirm your subscription.</p>
    )
  }
  return (
    <form onSubmit={handleSubmit}>
      <div data-element="fields" className="grid relative">
        <div className="relative">
          <figure className="absolute right-[-8px] bottom-3 md:bottom-4">
            <img height={38} width={38} src={bytesImage} alt="Bytes" />
          </figure>
          <input
            className="text-xs border border-black/50 dark:border-white/50 rounded p-2 mb-1 md:mb-2 w-full bg-transparent"
            name="email_address"
            placeholder="Your email address"
            type="email"
            required
          />
        </div>
        <button
          type="submit"
          className="text-xs mb-4 border rounded bg-rose-600 border-none text-white p-2"
        >
          {state !== 'loading' ? (
            <span>Subscribe</span>
          ) : (
            <span>Loading...</span>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        No spam. Unsubscribe at <em>any</em> time.
      </p>
      {error && <p className="text-red-600">{error}</p>}
    </form>
  )
}
