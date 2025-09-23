import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { partners } from '~/utils/partners'
import { PartnershipCallout } from './PartnershipCallout'
import { LibraryId } from '~/libraries'

type PartnersSectionProps = {
  libraryId?: LibraryId
  title?: string
  showPreviousLink?: boolean
}

export function PartnersSection({
  libraryId,
  title = 'Partners',
  showPreviousLink = true,
}: PartnersSectionProps) {
  if (!libraryId) {
    throw new Error('Library ID is required')
  }

  const filtered = partners.filter((p) =>
    libraryId
      ? p.libraries?.includes(libraryId as any) && p.status === 'active'
      : p.status === 'active'
  )

  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto mx-auto max-w-full">
      {filtered.length ? (
        <div className="space-y-8">
          <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
            {title}
          </h3>
          <div className={`flex flex-wrap gap-6 justify-center relative`}>
            {partners
              .filter((partner) => partner.status === 'active')
              .map((partner) => {
                return (
                  <a
                    key={partner.name}
                    href={partner.href}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white/80 shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 dark:bg-black/40 dark:shadow-none
                    overflow-hidden flex grow-1 justify-center p-8 hover:scale-[1.05] transition-all duration-100 ease-out"
                  >
                    <div
                      className="z-0 row-start-1 col-start-1 flex items-center justify-center transition-all duration-200"
                      style={{
                        width: Math.max(
                          Math.round(100 + 300 * partner.score),
                          150
                        ),
                      }}
                    >
                      {partner.homepageImg}
                    </div>
                    {/* <div className="z-10 row-start-1 col-start-1 max-w-full p-4 text-sm flex flex-col gap-4 items-start justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/70 dark:bg-gray-800/80">
                      {partner.content}
                    </div> */}
                  </a>
                )
              })}
          </div>
          <PartnershipCallout libraryId={libraryId} />
          {showPreviousLink ? (
            <div className="text-center mt-6">
              <Link
                to="/partners"
                search={
                  libraryId
                    ? { libraries: [libraryId], status: 'inactive' }
                    : { status: 'inactive' }
                }
                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                View Previous Partners →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
