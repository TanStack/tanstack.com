import { Link } from '@tanstack/react-router'
import { GamFooter } from './Gam'
import { AdGate } from '~/contexts/AdsContext'

export default function LandingPageGad() {
  return (
    <AdGate>
      <div className={`lg:max-[400px] px-4 mx-auto`}>
        <div className="flex flex-col gap-4 items-center">
          <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 dark:text-white mx-auto">
            <GamFooter />
            <div
              className="text-xs bg-gray-500 bg-opacity-10 py-2 px-4 rounded text-gray-600 dark:text-gray-300
                dark:bg-opacity-20 self-center text-center max-w-[500px] space-y-2"
            >
              <div>
                <span className="font-medium italic">
                  An ad on an open source project?
                </span>{' '}
                <span className="font-black">What is this, 1999?</span>
              </div>
              <div>
                <span className="font-medium italic">Please...</span> TanStack
                is 100% privately owned, with no paid products, venture capital,
                or acquisition plans. We're a small team dedicated to creating
                software used by millions daily. What did you expect?
              </div>
              <div>
                <Link
                  to="/ethos"
                  className="text-gray-600 dark:text-gray-200 font-bold underline"
                >
                  Check out our ethos
                </Link>{' '}
                to learn more about how we plan on sticking around (and staying
                relevant) for the long-haul.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdGate>
  )
}
