import { PartnerTierLogo } from '~/components/ds/ui/PartnerTierLogo'
import { partners, partnerTierLabels, type Partner } from '~/utils/partners'
import { getPartnerTierGroupsForPlacement } from '~/utils/partner-placement'
import { usePartnerPlacementContext } from '~/utils/usePartnerPlacementContext'

export function PartnerList({
  status = 'active',
}: {
  status?: Partner['status']
}) {
  const context = usePartnerPlacementContext({
    orderStrategy: 'tier-rotated',
    surface: `markdown-partners-${status}`,
  })
  const groups = getPartnerTierGroupsForPlacement(
    partners.filter((partner) => partner.status === status),
    context,
  )

  return (
    <div className="not-prose my-8 space-y-7">
      {groups.map((group) => (
        <section
          key={group.tier}
          aria-label={`${status === 'inactive' ? 'Previous ' : ''}${partnerTierLabels[group.tier]} partners`}
        >
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
            {status === 'inactive' ? 'Previous ' : ''}
            {partnerTierLabels[group.tier]} partners
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.partners.map((partner) => (
              <a
                key={partner.id}
                href={`/partners/${partner.id}`}
                className="flex min-h-24 items-center justify-center rounded-lg border border-gray-200 p-5 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:hover:bg-gray-900"
              >
                <PartnerTierLogo
                  image={partner.image}
                  name={partner.name}
                  tier={group.tier}
                />
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function PreviousPartnerList() {
  return <PartnerList status="inactive" />
}
