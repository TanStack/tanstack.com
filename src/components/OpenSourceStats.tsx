import { convexQuery } from '@convex-dev/react-query'
import { useNpmDownloadCounter } from '@erquhart/convex-oss-stats/react'
import NumberFlow from '@number-flow/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import convexImageDark from '~/images/convex-dark.svg'
import convexImageWhite from '~/images/convex-white.svg'
import { api } from 'convex/_generated/api'
import { FaCube, FaDownload, FaStar, FaUsers } from 'react-icons/fa'

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
      .join(''),
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
    }),
  )
  const { data: npm } = useSuspenseQuery(
    convexQuery(api.stats.getNpmOrg, {
      name: 'tanstack',
    }),
  )

  return (
    <div>
      <div className="grid grid-cols-1 items-center justify-center gap-8 rounded-xl bg-white/50 p-8 shadow-xl sm:grid-cols-2 xl:grid-cols-4 xl:place-items-center dark:bg-gray-700/30 dark:shadow-none">
        <a
          href="https://www.npmjs.com/org/tanstack"
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-4"
        >
          <FaDownload className="text-2xl transition-colors duration-200 group-hover:text-emerald-500" />
          <div>
            <div className="relative text-2xl font-bold opacity-80 transition-colors duration-200 group-hover:text-emerald-500">
              <NpmDownloadCounter npmData={npm} />
            </div>
            <div className="text-sm font-medium italic opacity-50 transition-colors duration-200 group-hover:text-emerald-500">
              NPM Downloads
            </div>
          </div>
        </a>
        <a
          href="https://github.com/orgs/TanStack/repositories?q=sort:stars"
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-4"
        >
          <FaStar className="text-2xl transition-colors duration-200 group-hover:text-yellow-500" />
          <div>
            <div className="text-2xl leading-none font-bold opacity-80 transition-colors duration-200 group-hover:text-yellow-500">
              <NumberFlow value={github?.starCount} />
            </div>
            <div className="-mt-1 text-sm font-medium italic opacity-50 transition-colors duration-200 group-hover:text-yellow-500">
              Stars on Github
            </div>
          </div>
        </a>
        <div className="flex items-center gap-4">
          <FaUsers className="text-2xl" />
          <div className="">
            <div className="text-2xl font-bold opacity-80">
              <NumberFlow value={github?.contributorCount} />
            </div>
            <div className="-mt-1 text-sm font-medium italic opacity-50">
              Contributors on GitHub
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <FaCube className="text-2xl" />
          <div className="">
            <div className="relative text-2xl font-bold opacity-80">
              <NumberFlow value={github?.dependentCount} />
            </div>
            <div className="-mt-1 text-sm font-medium italic opacity-50">
              Dependents on GitHub
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end px-4 py-2">
        <a
          href="https://www.convex.dev/?utm_source=tanstack"
          className="group flex items-center gap-2"
        >
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
          <div className="flex items-center gap-1">
            <span className="relative -top-px text-[.75rem] opacity-30">
              Powered by
            </span>
            <img
              className="opacity-30 group-hover:opacity-50 dark:hidden"
              src={convexImageDark}
              alt="Convex Logo"
              width={80}
            />
            <img
              className="hidden opacity-30 group-hover:opacity-50 dark:block"
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
