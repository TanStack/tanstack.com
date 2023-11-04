import { Link } from '@remix-run/react'

type DefaultCatchBoundaryType = {
  status: number
  statusText: string
  data: string
  isRoot?: boolean
}

export function DefaultCatchBoundary({
  status,
  statusText,
  data,
  isRoot,
}: DefaultCatchBoundaryType) {
  let message
  switch (status) {
    case 401:
      message = (
        <p>
          Oops! Looks like you tried to visit a page that you do not have access
          to.
        </p>
      )
      break
    case 404:
      message = (
        <p>Oops! Looks like you tried to visit a page that does not exist.</p>
      )
      break

    default:
      throw new Error(data || statusText)
  }

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="opacity-10 flex flex-col text-center font-black">
        <div className="text-7xl leading-none">{status}</div>
        {statusText ? (
          <div className="text-3xl leading-none">{statusText}</div>
        ) : null}
      </h1>
      {message ? <div className="text-lg">{message}</div> : null}
      {isRoot ? (
        <Link
          to="/"
          className={`py-2 px-4 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
        >
          TanStack Home
        </Link>
      ) : null}
    </div>
  )
}
