import { createFileRoute } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { getLibrary } from '~/libraries'
import { ContributorsWall } from '~/components/ContributorsWall'
import { getLibraryContributors } from '~/libraries/maintainers'
import {
  MaintainerCard,
  CompactMaintainerCard,
  MaintainerRowCard,
} from '~/components/MaintainerCard'
import { useState } from 'react'
import { GridFourIcon, GridNineIcon, RowsIcon } from '@phosphor-icons/react'
import { SegmentedControl } from '~/components/ButtonGroup'

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/contributors',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const [viewMode, setViewMode] = useState<'compact' | 'full' | 'row'>('full')

  // Get the maintainers for this library
  const libraryContributors = getLibraryContributors(libraryId)

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <DocContainer>
        <div
          className={twMerge(
            'w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-[1200px]',
          )}
        >
          <div
            className={twMerge('flex overflow-auto flex-col w-full p-4 lg:p-6')}
          >
            <DocTitle>{library.name} Maintainers and Contributors</DocTitle>
            <div className="h-4" />

            {/* View Mode Toggle */}
            <div className="flex justify-start my-6">
              <SegmentedControl
                aria-label="Card layout"
                size="sm"
                value={viewMode}
                onValueChange={setViewMode}
                options={[
                  {
                    value: 'compact',
                    label: <GridNineIcon />,
                    'aria-label': 'Compact cards',
                  },
                  {
                    value: 'full',
                    label: <GridFourIcon />,
                    'aria-label': 'Full cards',
                  },
                  {
                    value: 'row',
                    label: <RowsIcon />,
                    'aria-label': 'Row cards',
                  },
                ]}
              />
            </div>

            <section>
              <div
                className={`transition-all duration-300 ${
                  viewMode === 'compact'
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                    : viewMode === 'row'
                      ? 'flex flex-col gap-4'
                      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                } mb-8 pt-8`}
              >
                {libraryContributors.map((maintainer, index) => (
                  <div
                    key={maintainer.github}
                    className="transition-all duration-300 ease-out transform"
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: 'fadeInUp 0.5s ease-out forwards',
                    }}
                  >
                    {viewMode === 'compact' ? (
                      <CompactMaintainerCard maintainer={maintainer} />
                    ) : viewMode === 'row' ? (
                      <MaintainerRowCard
                        maintainer={maintainer}
                        libraryId={library.id}
                      />
                    ) : (
                      <MaintainerCard
                        maintainer={maintainer}
                        libraryId={library.id}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="h-px bg-gray-500 opacity-20" />
            <div className="h-4" />

            <h2 className="text-xl font-bold mb-4">All-Time Contributors</h2>
            <ContributorsWall library={library} />
            <div className="h-24" />
          </div>
        </div>
      </DocContainer>
    </>
  )
}
