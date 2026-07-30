import * as React from 'react'
import { PartnersGrid } from './PartnersGrid'
import { PartnershipCallout } from './PartnershipCallout'
import { Button } from '~/ui'
import { Link } from '@tanstack/react-router'

type PartnersSectionProps = {
  title?: string
  showPreviousLink?: boolean
}

export function PartnersSection({
  title = 'Partners',
  showPreviousLink = true,
}: PartnersSectionProps) {
  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto mx-auto max-w-full">
      <div className="space-y-8">
        <h3 className="text-3xl font-bold">{title}</h3>
        <PartnersGrid analyticsPlacement="library_grid" />
        <PartnershipCallout />
        {showPreviousLink ? (
          <div className="flex justify-center mt-6">
            <Link to="/partners" search={{ status: 'inactive' }}>
              <Button as="span">View Previous Partners</Button>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
