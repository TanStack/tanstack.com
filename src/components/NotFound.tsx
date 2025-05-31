import { Link } from '@tanstack/react-router'

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">404 Not Found</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400">
        The page you are looking for does not exist.
      </p>
      {children || (
        <p className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.history.back()}
            className="rounded bg-emerald-500 p-2 font-black text-white uppercase"
          >
            Go back
          </button>
          <Link
            to="/"
            className="rounded bg-cyan-600 p-2 font-black text-white uppercase"
          >
            Start Over
          </Link>
        </p>
      )}
    </div>
  )
}
