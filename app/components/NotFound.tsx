import { Link } from '@tanstack/react-router'

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="h-[50vh] flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">404 Not Found</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400">
        The page you are looking for does not exist.
      </p>
      {children || (
        <p className="text-lg text-gray-600 dark:text-gray-400">
          <Link
            to="/"
            className="bg-gray-500 text-white p-2 rounded uppercase font-black"
          >
            Go Home
          </Link>
        </p>
      )}
    </div>
  )
}
