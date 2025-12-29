import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { libraries } from '~/libraries'
import { reactChartsProject } from '~/libraries/react-charts'

export const Route = createFileRoute('/libraries')({
  component: LibrariesPage,
  head: () => ({
    meta: [
      {
        title: 'All Libraries - TanStack',
      },
      {
        name: 'description',
        content: 'Browse all TanStack libraries.',
      },
    ],
  }),
})

function LibrariesPage() {
  const allLibraries = libraries.filter((d) => d.to)
  const others = allLibraries.filter(
    (l) => l.id !== 'ranger' && l.id !== 'config' && l.id !== 'react-charts',
  )
  const ranger = allLibraries.filter((l) => l.id === 'ranger')
  const config = allLibraries.filter((l) => l.id === 'config')

  // Find devtools index in others to insert config after it
  const devtoolsIndex = others.findIndex((l) => l.id === 'devtools')
  const ordered = [
    ...others.slice(0, devtoolsIndex + 1),
    ...config,
    ...others.slice(devtoolsIndex + 1),
    ...ranger,
  ]

  const deprecatedLibraries = [reactChartsProject]

  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto py-10">
      <h1 className="text-4xl font-light">All Libraries</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        Browse all TanStack libraries.
      </p>

      <div
        className={`grid grid-cols-1 gap-6 gap-y-8 justify-center mt-8
        sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3`}
      >
        {ordered.map((library, i) => {
          const isRanger = library.id === 'ranger'
          return (
            <Link
              key={library.id}
              to={library.to ?? '#'}
              className={twMerge(
                `border-2 rounded-xl shadow-md p-8 transition-all duration-300 ease-out
                bg-white/90 dark:bg-black/40 backdrop-blur-sm`,
                isRanger
                  ? 'border-transparent shadow-xl shadow-slate-700/20 dark:shadow-lg dark:shadow-slate-500/30 hover:shadow-2xl hover:border-slate-400/70 hover:-translate-y-1'
                  : 'border-gray-200 dark:border-gray-800/50 hover:shadow-2xl hover:shadow-current/20 hover:border-current/50 hover:-translate-y-1',
                'relative group',
                'min-h-[250px] xl:min-h-[220px]',
                !isRanger && library.cardStyles,
              )}
              style={{
                zIndex: i,
                willChange: 'transform',
              }}
            >
              {/* Background content that will blur on hover */}
              <div className="z-0 relative group-hover:blur-[0.5px] transition-[filter] duration-300 ease-out">
                <div className="flex gap-2 justify-between items-center">
                  <div
                    className={twMerge(
                      `flex items-center gap-2 text-[1.2rem] font-extrabold uppercase [letter-spacing:-.04em]`,
                    )}
                    style={{
                      viewTransitionName: `library-name-${library.id}`,
                    }}
                  >
                    <span
                      className={twMerge(
                        'rounded-lg leading-none flex items-center',
                        isRanger
                          ? 'bg-slate-500 dark:bg-slate-400'
                          : 'bg-current',
                      )}
                    >
                      <span className="text-white dark:text-black text-xs leading-none p-1.5 px-2 uppercase">
                        TanStack
                      </span>
                    </span>
                    <span
                      className={
                        isRanger
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-current'
                      }
                    >
                      {library.name.replace('TanStack ', '')}
                    </span>
                  </div>
                </div>
                <div
                  className={twMerge(
                    `text-sm italic font-medium mt-3`,
                    isRanger
                      ? 'text-slate-500 dark:text-slate-400'
                      : 'text-current',
                  )}
                >
                  {library.tagline}
                </div>

                {/* Description preview with ellipsis */}
                <div
                  className={`text-sm mt-3 text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed`}
                >
                  {library.description}
                </div>
              </div>

              {/* Foreground content that appears on hover */}
              <div
                className="absolute inset-0 z-30 bg-white/95 dark:bg-black/95 p-6 rounded-xl
                backdrop-blur-sm flex flex-col justify-center opacity-0 group-hover:opacity-100
                transition-opacity duration-300 ease-out pointer-events-none group-hover:pointer-events-auto"
              >
                <div
                  className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed`}
                >
                  {library.description}
                </div>
                <div className="mt-6 text-center">
                  <span
                    className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/10 
                    rounded-full text-sm font-medium text-gray-900 dark:text-white"
                  >
                    Click to learn more
                    <svg
                      className="w-4 h-4 transform transition-transform duration-200 group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>
              </div>
              {/* Badge */}
              {library.badge && !isRanger ? (
                <div
                  className={twMerge(
                    `absolute -top-2 -right-2 z-40 px-2 py-1 rounded-md`,
                    ['bg-gradient-to-r', library.colorFrom, library.colorTo],
                    'uppercase text-white font-black italic text-xs',
                  )}
                  style={{
                    animation: 'pulseScale 3s infinite',
                    animationTimingFunction: 'ease-in-out',
                    animationDelay: `${i * 0.5}s`,
                    ['--scale-factor' as any]: '1.1',
                  }}
                >
                  <span>{library.badge}</span>
                </div>
              ) : null}
            </Link>
          )
        })}
      </div>

      {deprecatedLibraries.length > 0 && (
        <>
          <h2 className="text-3xl font-light mt-16 mb-8">
            Deprecated Libraries
          </h2>
          <div
            className={`grid grid-cols-1 gap-6 gap-y-8 justify-center
            sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3`}
          >
            {deprecatedLibraries.map((library, i) => {
              const isExternal = library.to?.startsWith('http')
              const hasTanStackPrefix = library.name.startsWith('TanStack ')
              const cardContent = (
                <>
                  {/* Background content that will blur on hover */}
                  <div className="z-0 relative group-hover:blur-[0.5px] transition-[filter] duration-300 ease-out">
                    <div className="flex gap-2 justify-between items-center">
                      <div
                        className={twMerge(
                          `flex items-center gap-2 text-[1.2rem] font-extrabold uppercase [letter-spacing:-.04em]`,
                        )}
                        style={{
                          viewTransitionName: `library-name-${library.id}`,
                        }}
                      >
                        {hasTanStackPrefix ? (
                          <>
                            <span className="bg-slate-500 dark:bg-slate-400 rounded-lg leading-none flex items-center">
                              <span className="text-white dark:text-black text-xs leading-none p-1.5 px-2 uppercase">
                                TanStack
                              </span>
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {library.name.replace('TanStack ', '')}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            {library.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm italic font-medium mt-3 text-slate-500 dark:text-slate-400">
                      {library.tagline}
                    </div>

                    {/* Description preview with ellipsis */}
                    <div
                      className={`text-sm mt-3 text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed`}
                    >
                      {library.description}
                    </div>
                  </div>

                  {/* Foreground content that appears on hover */}
                  <div
                    className="absolute inset-0 z-30 bg-white/95 dark:bg-black/95 p-6 rounded-xl
                    backdrop-blur-sm flex flex-col justify-center opacity-0 group-hover:opacity-100
                    transition-opacity duration-300 ease-out pointer-events-none group-hover:pointer-events-auto"
                  >
                    <div
                      className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed`}
                    >
                      {library.description}
                    </div>
                    <div className="mt-6 text-center">
                      <span
                        className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/10 
                        rounded-full text-sm font-medium text-gray-900 dark:text-white"
                      >
                        Click to learn more
                        <svg
                          className="w-4 h-4 transform transition-transform duration-200 group-hover:translate-x-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </>
              )

              const cardClassName = twMerge(
                `border-2 rounded-xl shadow-md p-8 transition-all duration-300 ease-out
                bg-white/90 dark:bg-black/40 backdrop-blur-sm`,
                'border-transparent shadow-xl shadow-slate-700/20 dark:shadow-lg dark:shadow-slate-500/30 hover:shadow-2xl hover:border-slate-400/70 hover:-translate-y-1',
                'relative group',
                'min-h-[250px] xl:min-h-[220px]',
              )

              return isExternal ? (
                <a
                  key={library.id}
                  href={library.to}
                  className={cardClassName}
                  style={{
                    zIndex: i,
                    willChange: 'transform',
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cardContent}
                </a>
              ) : (
                <Link
                  key={library.id}
                  to={library.to ?? '#'}
                  className={cardClassName}
                  style={{
                    zIndex: i,
                    willChange: 'transform',
                  }}
                >
                  {cardContent}
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
