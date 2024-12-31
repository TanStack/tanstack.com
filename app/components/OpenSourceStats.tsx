import { convexQuery } from '@convex-dev/react-query'
import { useNpmDownloadCounter } from '@erquhart/convex-oss-stats/react'
import NumberFlow from '@number-flow/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { FaCube, FaStar, FaUsers } from 'react-icons/fa'
import { FaDownload } from 'react-icons/fa'
import convexImageWhite from '~/images/convex-white.svg'
import convexImageDark from '~/images/convex-dark.svg'

const StableCounter = ({
  value,
  intervalMs,
}: {
  value?: number
  intervalMs?: number
}) => {
  const dummyString = Number(
    Array(value?.toString().length ?? 1)
      .fill('8')
      .join('')
  ).toLocaleString()

  return (
    <>
      {/* Dummy span to prevent layout shift */}
      <span className="opacity-0">{dummyString}</span>
      <span className="absolute -top-0.5 left-0">
        <NumberFlow
          // Defer to counter hook calculated interval
          spinTiming={{
            duration: intervalMs,
            easing: 'linear',
          }}
          // Slow horizontal shift animation (due to differing number widths)
          transformTiming={{
            duration: 1000,
            easing: 'linear',
          }}
          value={value}
          trend={1}
          continuous
          willChange
        />
      </span>
    </>
  )
}

const NpmDownloadCounter = ({
  npmData,
}: {
  npmData: Parameters<typeof useNpmDownloadCounter>[0]
}) => {
  const { count, intervalMs } = useNpmDownloadCounter(npmData)
  return <StableCounter value={count} intervalMs={intervalMs} />
}

export default function OssStats() {
  const { data: github } = useSuspenseQuery(
    convexQuery(api.stats.getGithubOwner, {
      owner: 'tanstack',
    })
  )
  const { data: npm } = useSuspenseQuery(
    convexQuery(api.stats.getNpmOrg, {
      name: 'tanstack',
    })
  )

  return (
    <div>
      <div className="p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8 items-center justify-center xl:place-items-center bg-white/50 dark:bg-gray-700/30 dark:shadow-none rounded-xl shadow-xl">
        <a
          href="https://www.npmjs.com/org/tanstack"
          target="_blank"
          rel="noreferrer"
          className="group flex gap-4 items-center"
        >
          <FaDownload className="text-2xl group-hover:text-emerald-500 transition-colors duration-200" />
          <div>
            <div className="text-2xl font-bold opacity-80 relative group-hover:text-emerald-500 transition-colors duration-200">
              <NpmDownloadCounter npmData={npm} />
            </div>
            <div className="text-sm opacity-50 font-medium italic group-hover:text-emerald-500 transition-colors duration-200">
              NPM Downloads
            </div>
          </div>
        </a>
        <a
          href="https://github.com/orgs/TanStack/repositories?q=sort:stars"
          target="_blank"
          rel="noreferrer"
          className="group flex gap-4 items-center"
        >
          <FaStar className="group-hover:text-yellow-500 text-2xl transition-colors duration-200" />
          <div>
            <div className="text-2xl font-bold opacity-80 leading-none group-hover:text-yellow-500 transition-colors duration-200">
              <NumberFlow value={github?.starCount} />
            </div>
            <div className="text-sm opacity-50 font-medium italic -mt-1 group-hover:text-yellow-500 transition-colors duration-200">
              Stars on Github
            </div>
          </div>
        </a>
        <div className="flex gap-4 items-center">
          <FaUsers className="text-2xl" />
          <div className="">
            <div className="text-2xl font-bold opacity-80">
              <NumberFlow value={github?.contributorCount} />
            </div>
            <div className="text-sm opacity-50 font-medium italic -mt-1">
              Contributors on GitHub
            </div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <FaCube className="text-2xl" />
          <div className="">
            <div className="text-2xl font-bold opacity-80 relative">
              <NumberFlow value={github?.dependentCount} />
            </div>
            <div className="text-sm opacity-50 font-medium italic -mt-1">
              Dependents on GitHub
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 flex justify-end">
        <a
          href="https://www.convex.dev/?utm_source=tanstack"
          className="group flex items-center gap-2"
        >
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
          <div className="flex items-center gap-1">
            <span className="text-[.75rem] opacity-30 relative -top-px">
              Powered by
            </span>
            <img
              className="dark:hidden opacity-30 group-hover:opacity-50"
              src={convexImageDark}
              alt="Convex Logo"
              width={80}
            />
            <img
              className="hidden dark:block opacity-30 group-hover:opacity-50"
              src={convexImageWhite}
              alt="Convex Logo"
              width={80}
            />
          </div>
        </a>
      </div>
    </div>
  )
}
