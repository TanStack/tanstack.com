import { Link } from '@tanstack/react-router'
import { TbGhost } from 'react-icons/tb'

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="p-4 flex-1">
      <div className="p-8 flex flex-col items-center justify-center gap-6 bg-white/90 dark:bg-black/90 rounded-xl">
        <h1 className="text-3xl font-black uppercase [letter-spacing:-0.02em]">
          404 Not Found
        </h1>
        <TbGhost className="text-[10rem] opacity-20 hover:opacity-100 animate-bounce mt-8 blur-md hover:blur-none transition-all duration-300" />
        <p>The page you are looking for does not exist.</p>
        {children || (
          <p className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.history.back()}
              className="bg-emerald-500 text-white p-2 rounded uppercase font-black"
            >
              Go back
            </button>
            <Link
              to="/"
              className="bg-cyan-600 text-white p-2 rounded uppercase font-black"
            >
              Start Over
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
