import { PartnersGrid } from '~/components/PartnersGrid'
import type { Partner } from '~/utils/partners'

export function PartnerList({
  status = 'active',
}: {
  status?: Partner['status']
}) {
  return (
    <div className="not-prose my-8">
      <PartnersGrid status={status} />
    </div>
  )
}

export function PreviousPartnerList() {
  return <PartnerList status="inactive" />
}
