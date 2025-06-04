import { Library, Framework, frameworkOptions } from '~/libraries'
import {
  getRoleInLibrary,
  Maintainer,
  getPersonsMaintainerOf,
} from '~/libraries/maintainers'
import { useState } from 'react'

function RoleBadge({ role }: { role: string }) {
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

function LibraryBadge({ library }: { library: Library }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 ${
        library.bgStyle ?? 'bg-gray-500'
      } bg-opacity-20 dark:bg-opacity-20`}
    >
      {library.name}
    </span>
  )
}

interface MaintainerCardProps {
  maintainer: Maintainer
  libraryId?: Library['id']
}

export function MaintainerCard({ maintainer, libraryId }: MaintainerCardProps) {
  const libraries = getPersonsMaintainerOf(maintainer)
  const [showAllLibraries, setShowAllLibraries] = useState(false)

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
          loading="lazy"
          decoding="async"
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
        {!libraryId && libraries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {libraries
              .slice(0, showAllLibraries ? undefined : 2)
              .map((library) => (
                <LibraryBadge key={library.id} library={library} />
              ))}
            {!showAllLibraries && libraries.length > 2 && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowAllLibraries(true)
                }}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                +{libraries.length - 3} more
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{maintainer.name}</h3>
          {libraryId && (
            <RoleBadge role={getRoleInLibrary(maintainer, libraryId)} />
          )}
        </div>
        <div className="flex items-center space-x-4 text-gray-400 dark:text-gray-500 [&>*]:grayscale">
          <a
            href={`https://github.com/${maintainer.github}`}
            className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -m-2 hover:grayscale-0"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 16 16" className="w-5 h-5" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
          </a>
          {maintainer.social?.twitter && (
            <a
              href={maintainer.social.twitter}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -m-2 hover:grayscale-0"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          )}
          {maintainer.social?.bluesky && (
            <a
              href={maintainer.social.bluesky}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -m-2 hover:grayscale-0"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-lg">🦋</span>
            </a>
          )}
          {maintainer.social?.website && (
            <a
              href={maintainer.social.website}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -m-2 hover:grayscale-0"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </a>
  )
}
