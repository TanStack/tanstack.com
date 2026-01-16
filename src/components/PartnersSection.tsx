import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { partners } from '~/utils/partners'
import { PartnersGrid } from './PartnersGrid'
import { PartnershipCallout } from './PartnershipCallout'
import { LibraryId } from '~/libraries'
import { Button } from '~/ui'

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
      : p.status === 'active',
  )

  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto mx-auto max-w-full">
      {filtered.length ? (
        <div className="space-y-8">
          <h3 className="text-3xl font-bold">{title}</h3>
          <PartnersGrid />
          <PartnershipCallout libraryId={libraryId} />
          {showPreviousLink ? (
            <div className="flex justify-center mt-6">
              <Button
                as={Link}
                to="/partners"
                search={
                  (libraryId
                    ? { libraries: [libraryId], status: 'inactive' }
                    : { status: 'inactive' }) as any
                }
              >
                View Previous Partners
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
