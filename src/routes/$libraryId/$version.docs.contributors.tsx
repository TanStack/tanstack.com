import { twMerge } from 'tailwind-merge'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { getLibrary } from '~/libraries'
import { ContributorsWall } from '~/components/ContributorsWall'
import {} from '@tanstack/react-router'
import { getLibraryContributors } from '~/libraries/maintainers'
import { MaintainerCard } from '~/components/MaintainerCard'

export const Route = createFileRoute({
  component: RouteComponent,
})

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)

  // Get the maintainers for this library
  const libraryContributors = getLibraryContributors(libraryId)

  return (
    <DocContainer>
      <div
        className={twMerge(
          'w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-[1200px]'
        )}
      >
        <div
          className={twMerge('flex overflow-auto flex-col w-full p-4 lg:p-6')}
        >
          <DocTitle>{library.name} Maintainers and Contributors</DocTitle>
          <div className="h-4" />
          <section>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-8 pt-8">
              {libraryContributors.map((maintainer) => (
                <MaintainerCard
                  key={maintainer.github}
                  maintainer={maintainer}
                  libraryId={library.id}
                />
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
  )
}
