import { Link, isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'

export const DefaultErrorBoundary = () => {
  const error = useRouteError()

  // when true, this is what used to go to `CatchBoundary`
  if (isRouteErrorResponse(error)) {
    return (
      <DefaultCatchBoundary
        status={error.status}
        statusText={error.statusText}
        data={error.data}
        isRoot={false}
      />
    )
  }

  console.error(error)

  // Don't forget to typecheck with your own logic.
  // Any value can be thrown, not just errors!
  let errorMessage = 'Unknown error'
  if (error instanceof Error) {
    errorMessage = error.message
  }

  return (
    <div className="w-full h-full flex flex-col gap-2 items-center justify-center p-4">
      <h1 className="text-lg font-bold">Something went wrong!</h1>
      <div>{errorMessage}</div>
      <div>We'll get this fixed asap.</div>
      <Link
        to="/"
        className={`py-2 px-4 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
      >
        TanStack Home
      </Link>
    </div>
  )
}
