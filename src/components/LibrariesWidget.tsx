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
        <a href="/#libraries" className="font-semibold text-sm">
          Libraries
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {featuredLibraries.map((library) => (
          <a
            key={library.id}
            href={`/${library.id}/latest`}
            className="text-xs opacity-70 hover:opacity-100 hover:underline"
          >
            {library.name.replace('TanStack ', '')}
          </a>
        ))}
      </div>
    </div>
  )
}
