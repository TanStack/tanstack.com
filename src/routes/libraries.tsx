import { Link, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { type Library } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import { reactChartsProject } from '~/libraries/react-charts'
import LibraryCard from '~/components/LibraryCard'
import {
  getFrameworkLibraryCounts,
  getVisibleLibraries,
  orderLibrariesForBrowse,
} from './-libraries-utils'

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
  const allLibraries = getVisibleLibraries()
  const ordered = orderLibrariesForBrowse(allLibraries)
  const frameworkCounts = getFrameworkLibraryCounts(allLibraries)
  const frameworksWithLibraries = frameworkOptions.filter(
    (framework) => (frameworkCounts[framework.value] ?? 0) > 0,
  )
  const deprecatedLibraries = [reactChartsProject]

  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto py-10">
      <h1 className="text-4xl font-light">All Libraries</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        Browse all TanStack libraries.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-medium">Browse by Your Framework</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {frameworksWithLibraries.map((framework) => {
            const count = frameworkCounts[framework.value] ?? 0

            return (
              <Link
                key={framework.value}
                to="/libraries/$framework"
                params={{
                  framework: framework.value,
                }}
                className="group inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-current hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
              >
                <img
                  src={framework.logo}
                  alt=""
                  loading="lazy"
                  className="h-5 w-5 object-contain"
                />
                <span>{framework.label}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {count} {count === 1 ? 'library' : 'libraries'}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <div
        className={`grid grid-cols-1 gap-6 gap-y-8 justify-center mt-8
        sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3`}
      >
        {ordered.map((library, i) => {
          return (
            <LibraryCard
              key={library.id}
              library={library as Library}
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
