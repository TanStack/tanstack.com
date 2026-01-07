import { Link } from '@tanstack/react-router'
import { LibraryId } from '~/libraries'
import { getLibraryMaintainers } from '~/libraries/maintainers'
import { Button } from './Button'
import { CompactMaintainerCard } from './MaintainerCard'

type MaintainersSectionProps = {
  libraryId: LibraryId
}

export function MaintainersSection({ libraryId }: MaintainersSectionProps) {
  const maintainers = getLibraryMaintainers(libraryId)

  if (!maintainers.length) {
    return null
  }

  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
      <div className="space-y-8">
        <h3 className="text-3xl font-bold">Maintainers</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {maintainers.map((maintainer) => (
            <div key={maintainer.github} className="aspect-square">
              <CompactMaintainerCard maintainer={maintainer} />
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <Button
            as={Link}
            to="/$libraryId/$version/docs/contributors"
            params={{ libraryId, version: 'latest' } as never}
          >
            View All Maintainers →
          </Button>
        </div>
      </div>
    </div>
  )
}
