import { Link } from '@tanstack/react-router'
import { GadFooter } from './GoogleScripts'

export default function LandingPageGad() {
  return (
    <div className={`lg:max-[400px] mx-auto px-4`}>
      <div className="flex flex-col items-center gap-4">
        <div className="mx-auto overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800 dark:text-white">
          <GadFooter />
        </div>
        <div className="w-[500px] max-w-full space-y-2 self-center rounded bg-gray-500/10 px-4 py-2 text-center text-xs text-gray-500 dark:bg-gray-500/20">
          <div>
            <span className="font-medium italic">
              An ad on an open source project?
            </span>{' '}
            <span className="font-black">What is this, 1999?</span>
          </div>
          <div>
            <span className="font-medium italic">Please...</span> TanStack is
            100% privately owned, with no paid products, venture capital, or
            acquisition plans. We're a small team dedicated to creating software
            used by millions daily. What did you expect?
          </div>
          <div>
            <Link to="/ethos" className="font-bold text-gray-500 underline">
              Check out our ethos
            </Link>{' '}
            to learn more about how we plan on sticking around (and staying
            relevant) for the long-haul.
          </div>
        </div>
      </div>
    </div>
  )
}
