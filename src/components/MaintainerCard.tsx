import { Library, Framework, frameworkOptions } from '~/libraries'
import {
  getRoleInLibrary,
  Maintainer,
  getPersonsMaintainerOf,
} from '~/libraries/maintainers'
import { useState } from 'react'

function RoleBadge({
  maintainer,
  libraryId,
}: {
  maintainer: Maintainer
  libraryId?: Library['id']
}) {
  const role = libraryId ? getRoleInLibrary(maintainer, libraryId) : ''
  const isCreator = role.toLowerCase().includes('creator')
  const isMaintainer = role.toLowerCase().includes('maintainer')
  const isCoreMaintainer = isMaintainer && maintainer.isCoreMaintainer

  if (isCreator) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
        {role}
      </span>
    )
  }

  if (isMaintainer) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isCoreMaintainer
            ? 'bg-gradient-to-r from-blue-400 to-blue-700 text-white shadow border border-blue-300'
            : 'bg-blue-500 text-white'
        }`}
      >
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
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor} bg-opacity-80 text-white gap-1`}
      aria-label={`Framework: ${frameworkOption?.label || framework}`}
    >
      <svg
        aria-hidden="true"
        className="w-3 h-3"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <circle cx="8" cy="8" r="8" />
      </svg>
      {frameworkOption?.label || framework}
    </span>
  )
}

function SpecialtyChip({ specialty }: { specialty: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800 gap-1 dark:bg-gray-700 dark:text-gray-200"
      aria-label={`Specialty: ${specialty}`}
    >
      <svg
        aria-hidden="true"
        className="w-3 h-3"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <rect x="2" y="2" width="12" height="12" rx="1" />
      </svg>
      {specialty}
    </span>
  )
}

function LibraryBadge({ library }: { library: Library }) {
  if (library.to) {
    return (
      <a
        href={`${library.to}/latest/docs/contributors`}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-green-900 dark:text-green-200 ${
          library.bgStyle ?? 'bg-gray-500'
        } bg-opacity-40 dark:bg-opacity-30 capitalize hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors`}
        aria-label={`View contributors for ${library.name}`}
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        title={`View all contributors for ${library.name}`}
      >
        {library.name.replace('TanStack', '🌴')}
      </a>
    )
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-green-900 dark:text-green-200 ${
        library.bgStyle ?? 'bg-gray-500'
      } bg-opacity-40 dark:bg-opacity-30 capitalize`}
      aria-label={`View contributors for ${library.name}`}
      title={`View all contributors for ${library.name}`}
    >
      {library.name.replace('TanStack', '🌴')}
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
    <div
      className="group bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg"
      aria-label={`Maintainer card for ${maintainer.name}`}
    >
      <a
        href={`https://github.com/${maintainer.github}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View ${maintainer.name}'s GitHub profile`}
        className="relative h-64 overflow-hidden block"
        tabIndex={0}
      >
        <img
          alt={`Avatar of ${maintainer.name}`}
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
                  <SpecialtyChip key={specialty} specialty={specialty} />
                ))}
              </div>
            )}
          </div>
        </div>
      </a>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span
            className="text-base font-bold"
            id={`maintainer-name-${maintainer.github}`}
          >
            {maintainer.name}
          </span>
          <div className="flex items-center gap-2">
            {libraryId && (
              <RoleBadge maintainer={maintainer} libraryId={libraryId} />
            )}
          </div>
        </div>
        {!libraryId && libraries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
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
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label={`Show ${libraries.length - 2} more libraries`}
                tabIndex={0}
                type="button"
              >
                +{libraries.length - 2} more
              </button>
            )}
          </div>
        )}
        <div className="flex items-center space-x-4 text-gray-400 dark:text-gray-500 [&>*]:grayscale pt-1">
          <a
            href={`https://github.com/${maintainer.github}`}
            className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -m-2 hover:grayscale-0"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub profile"
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-5 h-5"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
          </a>
          {maintainer.social?.twitter && (
            <a
              href={maintainer.social.twitter}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -m-2 hover:grayscale-0"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter profile"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="currentColor"
                aria-hidden="true"
              >
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
              aria-label="Bluesky profile"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-lg" aria-hidden="true">
                🦋
              </span>
            </a>
          )}
          {maintainer.social?.website && (
            <a
              href={maintainer.social.website}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -m-2 hover:grayscale-0"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Personal website"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
