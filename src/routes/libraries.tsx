import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { libraries, Library } from '~/libraries'
import { reactChartsProject } from '~/libraries/react-charts'
import LibraryCard from '~/components/LibraryCard'

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
            <LibraryCard
              key={library.id}
              library={library as Library}
              isGeneric={isRanger}
              index={i}
            />
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
              return (
                <LibraryCard
                  key={library.id}
                  library={library as Library}
                  index={i}
                  isGeneric={library.id === 'react-charts'}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
