import { Library, Framework, frameworkOptions } from '~/libraries'
import {
  getRoleInLibrary,
  Maintainer,
  getPersonsMaintainerOf,
} from '~/libraries/maintainers'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
// import { FaCode, FaGitAlt, FaComment, FaEye } from 'react-icons/fa'

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
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-linear-to-r from-purple-500 to-pink-500 text-white shadow-lg">
        {role}
      </span>
    )
  }

  if (isMaintainer) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isCoreMaintainer
            ? 'bg-linear-to-r from-blue-400 to-blue-700 text-white shadow border border-blue-300'
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
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor}/80 text-white gap-1`}
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
  const bgClass = `${library.bgStyle ?? 'bg-gray-500'}/40`
  if (library.to) {
    return (
      <a
        href={`${library.to}/latest/docs/contributors`}
        className={twMerge(
          `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-green-900 dark:text-green-200 capitalize hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors`,
          bgClass
        )}
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
      className={twMerge(
        `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-green-900 dark:text-green-200 capitalize`,
        bgClass
      )}
      aria-label={`View contributors for ${library.name}`}
      title={`View all contributors for ${library.name}`}
    >
      {library.name.replace('TanStack', '🌴')}
    </span>
  )
}

const MaintainerSocialIcons: Record<
  keyof Maintainer['social'],
  React.ReactNode
> = {
  twitter: (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  bluesky: (
    <svg
      viewBox="0 0 24 21"
      className="w-5 h-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.20238 1.4019C7.95375 3.43816 10.9136 7.56632 12 9.78164V15.6329C12 15.5084 11.9513 15.6491 11.8463 15.9523C11.2793 17.594 9.0645 24.0012 4.00012 18.8791C1.3335 16.1822 2.568 13.4854 7.422 12.6712C4.64512 13.1368 1.52325 12.3672 0.66675 9.34985C0.42 8.48185 0 3.13532 0 2.41322C0 -1.20394 3.21712 -0.066993 5.20238 1.4019ZM18.7976 1.4019C16.0462 3.43816 13.0864 7.56632 12 9.78164V15.6329C12 15.5084 12.0487 15.6491 12.1537 15.9523C12.7207 17.594 14.9355 24.0012 19.9999 18.8791C22.6665 16.1822 21.432 13.4854 16.578 12.6712C19.3549 13.1368 22.4768 12.3672 23.3333 9.34985C23.58 8.48185 24 3.13532 24 2.41322C24 -1.20394 20.7832 -0.066993 18.7976 1.4019Z" />
    </svg>
  ),
  website: (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  ),
  github: (
    <svg
      viewBox="0 0 16 16"
      className="w-5 h-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
    </svg>
  ),
}

function MaintainerSocialLinks({ maintainer }: { maintainer: Maintainer }) {
  const links = Object.entries({
    github: `https://github.com/${maintainer.github}`,
    ...(maintainer.social || {}),
  }).map(([key, value]) => {
    const Icon = MaintainerSocialIcons[key as keyof Maintainer['social']]
    return (
      <a
        key={key}
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={key}
        onClick={(e) => e.stopPropagation()}
        className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 -mb-2 -ml-2 hover:grayscale-0 hover:scale-110"
      >
        {Icon}
      </a>
    )
  })

  return (
    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-2 text-gray-400 dark:text-gray-500  pt-1">
      {links}
    </div>
  )
}

// GitHub stats component - commented out due to performance/accuracy concerns
/*
function GitHubStats({
  username,
  stats,
}: {
  username: string
  stats?: {
    totalCommits: number
    totalPullRequests: number
    totalIssues: number
    totalReviews: number
  }
}) {
  if (!stats) return null

  const totalContributions =
    stats.totalCommits +
    stats.totalPullRequests +
    stats.totalIssues +
    stats.totalReviews

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
      <div
        className="flex items-center gap-1"
        title="Total commits to TanStack repositories"
      >
        <FaCode className="w-3 h-3" />
        <span>{stats.totalCommits.toLocaleString()}</span>
      </div>
      <div
        className="flex items-center gap-1"
        title="Total pull requests to TanStack repositories"
      >
        <FaGitAlt className="w-3 h-3" />
        <span>{stats.totalPullRequests.toLocaleString()}</span>
      </div>
      <div
        className="flex items-center gap-1"
        title="Total issues opened in TanStack repositories"
      >
        <FaComment className="w-3 h-3" />
        <span>{stats.totalIssues.toLocaleString()}</span>
      </div>
      <div
        className="flex items-center gap-1"
        title="Total pull request reviews in TanStack repositories"
      >
        <FaEye className="w-3 h-3" />
        <span>{stats.totalReviews.toLocaleString()}</span>
      </div>
      <div
        className="text-xs text-gray-500 dark:text-gray-500"
        title="Total contributions to TanStack repositories"
      >
        {totalContributions.toLocaleString()} total
      </div>
    </div>
  )
}
*/

interface MaintainerCardProps {
  maintainer: Maintainer
  libraryId?: Library['id']
}

interface CompactMaintainerCardProps {
  maintainer: Maintainer
}

interface MaintainerRowCardProps {
  maintainer: Maintainer
  libraryId?: Library['id']
  stats?: {
    totalCommits: number
    totalPullRequests: number
    totalIssues: number
    totalReviews: number
  }
}

export function CompactMaintainerCard({
  maintainer,
}: CompactMaintainerCardProps) {
  return (
    <a
      href={`https://github.com/${maintainer.github}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${maintainer.name}'s GitHub profile`}
      className="group relative min-h-40 block rounded-lg shadow-lg overflow-hidden"
      tabIndex={0}
      style={{
        backgroundImage: `url(${maintainer.avatar})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-0 p-3 flex flex-col justify-end">
        <div className="text-white">
          <div className="text-sm font-bold leading-tight">
            {maintainer.name}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </a>
  )
}

export function MaintainerRowCard({
  maintainer,
  libraryId,
  stats,
}: MaintainerRowCardProps) {
  const libraries = getPersonsMaintainerOf(maintainer)
  const [showAllLibraries, setShowAllLibraries] = useState(false)

  return (
    <div
      className="group bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg w-full"
      aria-label={`Maintainer row card for ${maintainer.name}`}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Avatar Section */}
        <a
          href={`https://github.com/${maintainer.github}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${maintainer.name}'s GitHub profile`}
          className="relative shrink-0"
          tabIndex={0}
        >
          <div className="relative w-16 h-16 rounded-lg overflow-hidden">
            <img
              alt={`Avatar of ${maintainer.name}`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              src={maintainer.avatar}
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </a>

        {/* Main Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <span
                className="text-lg font-bold truncate"
                id={`maintainer-name-${maintainer.github}`}
              >
                {maintainer.name}
              </span>
              {libraryId && (
                <RoleBadge maintainer={maintainer} libraryId={libraryId} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <MaintainerSocialLinks maintainer={maintainer} />
            </div>
          </div>

          {/* All Pills Inline */}
          {((maintainer.frameworkExpertise &&
            maintainer.frameworkExpertise.length > 0) ||
            (maintainer.specialties && maintainer.specialties.length > 0) ||
            (!libraryId && libraries.length > 0)) && (
            <div className="flex flex-wrap gap-2 mt-2 max-w-full">
              {/* Framework chips */}
              {maintainer.frameworkExpertise &&
                maintainer.frameworkExpertise.length > 0 &&
                maintainer.frameworkExpertise.map((framework) => (
                  <FrameworkChip key={framework} framework={framework} />
                ))}

              {/* Specialty chips */}
              {maintainer.specialties &&
                maintainer.specialties.length > 0 &&
                maintainer.specialties.map((specialty) => (
                  <SpecialtyChip key={specialty} specialty={specialty} />
                ))}

              {/* Library badges */}
              {!libraryId &&
                libraries.length > 0 &&
                libraries
                  .slice(0, showAllLibraries ? undefined : 2)
                  .map((library) => (
                    <LibraryBadge key={library.id} library={library} />
                  ))}

              {/* Show more button */}
              {!libraryId && !showAllLibraries && libraries.length > 2 && (
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

          {/* GitHub Stats - commented out due to performance/accuracy concerns */}
          {/* <div className="mt-4">
            <GitHubStats username={maintainer.github} stats={stats} />
          </div> */}
        </div>
      </div>
    </div>
  )
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
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
        <MaintainerSocialLinks maintainer={maintainer} />
      </div>
    </div>
  )
}
