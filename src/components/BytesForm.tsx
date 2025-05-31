import useBytesSubmit from '~/components/useBytesSubmit'
import bytesImage from '~/images/bytes.svg'

export default function BytesForm() {
  const { state, handleSubmit, error } = useBytesSubmit()
  if (state === 'submitted') {
    return (
      <p>Success! Please, check your email to confirm your subscription.</p>
    )
  }
  return (
    <form onSubmit={handleSubmit}>
      <div data-element="fields" className="relative grid">
        <div className="relative">
          <figure className="absolute right-[-8px] bottom-3 md:bottom-4">
            <img height={38} width={38} src={bytesImage} alt="Bytes" />
          </figure>
          <input
            className="mb-1 w-full rounded border border-black/50 bg-transparent p-2 text-xs md:mb-2 dark:border-white/50"
            name="email_address"
            placeholder="Your email address"
            type="email"
            required
          />
        </div>
        <button
          type="submit"
          className="mb-4 rounded border border-none bg-rose-600 p-2 text-xs text-white"
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
