import { Link } from '@tanstack/react-router'
import { ArrowSquareOutIcon, CodeIcon } from '@phosphor-icons/react'
import type { PublicShowcase } from '~/db/types'
import { libraries } from '~/libraries'
import { showcaseLinkRel } from '~/utils/showcase.shared'

export function CommunityProjectCard({
  showcase,
}: {
  showcase: PublicShowcase
}) {
  return (
    <article className="flex items-start gap-3 border-b border-gray-200 py-5 dark:border-gray-800">
      <Link
        to="/showcase/$id"
        params={{ id: showcase.id }}
        className="group flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          {showcase.logoUrl ? (
            <img
              src={showcase.logoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-contain"
            />
          ) : (
            <CodeIcon className="size-5 text-gray-400" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            {showcase.name}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {showcase.tagline}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {showcase.libraries
              .slice(0, 3)
              .map(
                (id) =>
                  libraries
                    .find((library) => library.id === id)
                    ?.name.replace('TanStack ', '') ?? id,
              )
              .join(' · ')}
            {showcase.libraries.length > 3 &&
              ` +${showcase.libraries.length - 3}`}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center">
        {showcase.sourceUrl && (
          <a
            href={showcase.sourceUrl}
            target="_blank"
            rel={showcaseLinkRel(showcase)}
            aria-label={`View source for ${showcase.name}`}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <CodeIcon className="size-4" />
          </a>
        )}
        <a
          href={showcase.url}
          target="_blank"
          rel={showcaseLinkRel(showcase)}
          aria-label={`Visit ${showcase.name}`}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ArrowSquareOutIcon className="size-4" />
        </a>
      </div>
    </article>
  )
}
