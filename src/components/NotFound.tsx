import { Link } from '@tanstack/react-router'
import { Ghost } from 'lucide-react'
import { Button } from './Button'

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="p-4 flex-1">
      <div className="p-8 flex flex-col items-center justify-center gap-6 bg-white/90 dark:bg-black/90 rounded-xl">
        <h1 className="text-3xl font-black uppercase [letter-spacing:-0.02em]">
          404 Not Found
        </h1>
        <Ghost className="text-[10rem] opacity-20 hover:opacity-100 animate-bounce mt-8 blur-md hover:blur-none transition-all duration-300" />
        <p>The page you are looking for does not exist.</p>
        {children || (
          <p className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => window.history.back()}
              className="bg-emerald-500 border-emerald-500 hover:bg-emerald-600 text-white"
            >
              Go back
            </Button>
            <Button
              as={Link}
              to="/"
              className="bg-cyan-600 border-cyan-600 hover:bg-cyan-700 text-white"
            >
              Start Over
            </Button>
          </p>
        )}
      </div>
    </div>
  )
}
