import { Library } from '~/libraries'
import { getRoleInLibrary, Maintainer } from '~/libraries/maintainers'

function RoleBadge({ role, libraryId }: { role: string; libraryId: string }) {
  const isCreator = role.toLowerCase().includes('creator')
  const isMaintainer = role.toLowerCase().includes('maintainer')

  if (isCreator) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
        {role}
      </span>
    )
  }

  if (isMaintainer) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white">
        {role}
      </span>
    )
  }

  return <span className="text-gray-500 dark:text-gray-400">{role}</span>
}

interface MaintainerCardProps {
  maintainer: Maintainer
  libraryId: Library['id']
}

export function MaintainerCard({ maintainer, libraryId }: MaintainerCardProps) {
  return (
    <a
      href={`https://github.com/${maintainer.github}`}
      className="group bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="relative h-64 overflow-hidden">
        <img
          alt={`${maintainer.name}'s avatar`}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          src={maintainer.avatar}
          style={{
            aspectRatio: '1/1',
            objectFit: 'cover',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
      </div>
      <div className="p-3 space-y-1.5">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">{maintainer.name}</h3>
            <RoleBadge
              role={getRoleInLibrary(maintainer, libraryId)}
              libraryId={libraryId}
            />
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-2 flex items-center">
            <svg
              viewBox="0 0 16 16"
              className="w-4 h-4 mr-1"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            @{maintainer.github}
          </p>
        </div>
        <ul className="flex flex-wrap">
          {maintainer.specialties?.map((specialty: string) => (
            <li
              className="bg-gray-500/10 text-xs text-gray-500 dark:text-white rounded-full px-2 py-1 mr-2 mb-2"
              key={specialty}
            >
              {specialty}
            </li>
          ))}
        </ul>
      </div>
    </a>
  )
}
