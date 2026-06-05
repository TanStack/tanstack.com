import { Link } from '@tanstack/react-router'
import { libraries } from '~/libraries'

const featuredLibraries = libraries
  .filter((library) => library.visible !== false)
  .slice(0, 8)
  .map((library) => ({
    id: library.id,
    name: library.name,
  }))

export function LibrariesWidget() {
  return (
    <div className="p-4">
      <div className="mb-3">
        <Link to="/" hash="libraries" className="font-semibold text-sm">
          Libraries
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {featuredLibraries.map((library) => (
          <Link
            key={library.id}
            to="/$libraryId/$version"
            params={{ libraryId: library.id, version: 'latest' }}
            className="text-xs opacity-70 hover:opacity-100 hover:underline"
          >
            {library.name.replace('TanStack ', '')}
          </Link>
        ))}
      </div>
    </div>
  )
}
