import { ErrorBoundaryComponent } from '@remix-run/node'
import { Link } from '@remix-run/react'

export const DefaultErrorBoundary: ErrorBoundaryComponent = ({ error }) => {
  console.error(error)

  return (
    <div className="w-full h-full flex flex-col gap-2 items-center justify-center p-4">
      <h1 className="text-lg font-bold">Something went wrong!</h1>
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
