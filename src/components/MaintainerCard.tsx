import { Library, Framework, frameworkOptions } from '~/libraries'
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

function FrameworkChip({ framework }: { framework: Framework }) {
  const frameworkOption = frameworkOptions.find((f) => f.value === framework)
  const bgColor = frameworkOption?.color || 'bg-gray-500'

  return (
    <span
      className={`${bgColor} bg-opacity-30 backdrop-blur-sm text-white text-xs rounded-full px-2 py-1 font-medium`}
    >
      {frameworkOption?.label || framework}
    </span>
  )
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute inset-0 p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="space-y-2">
            <h3 className="text-white text-lg font-bold">{maintainer.name}</h3>
            {maintainer.frameworkExpertise &&
              maintainer.frameworkExpertise.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {maintainer.frameworkExpertise.map((framework) => (
                    <FrameworkChip key={framework} framework={framework} />
                  ))}
                </div>
              )}
            {maintainer.specialties && maintainer.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {maintainer.specialties.map((specialty) => (
                  <span
                    className="bg-white/20 backdrop-blur-sm text-white text-xs rounded-full px-2 py-1"
                    key={specialty}
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{maintainer.name}</h3>
          <RoleBadge
            role={getRoleInLibrary(maintainer, libraryId)}
            libraryId={libraryId}
          />
        </div>
        <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
          <a
            href={`https://github.com/${maintainer.github}`}
            className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
          </a>
          {maintainer.social?.twitter && (
            <a
              href={maintainer.social.twitter}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
              </svg>
            </a>
          )}
          {maintainer.social?.website && (
            <a
              href={maintainer.social.website}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </a>
  )
}
