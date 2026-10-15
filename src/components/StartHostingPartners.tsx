import * as React from 'react'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { twMerge } from 'tailwind-merge'
import {
  PartnerImage,
  partners,
  partnerTierFlares,
  partnerTierLabels,
} from '~/utils/partners'
import {
  getPartnerPlacementAnalyticsMetadata,
  getPartnerTierGroupsForPlacement,
  type PartnerPlacementContext,
} from '~/utils/partner-placement'
import { usePartnerPlacementContext } from '~/utils/usePartnerPlacementContext'
import { trackEvent, useTrackedImpression } from '~/utils/analytics'
import { getStartHostingPartners } from '~/utils/start-hosting-partners'

const startHostingGuideAnchors: Record<string, string | undefined> = {
  cloudflare: 'cloudflare-workers-official-partner',
  lovable: 'lovable-official-partner',
  netlify: 'netlify-official-partner',
  railway: 'railway-official-partner',
  render: 'render-official-partner',
  vercel: 'vercel-official-partner',
}

function StartHostingPartnerLogo({ partnerId }: { partnerId: string }) {
  const partner = partners.find((candidate) => candidate.id === partnerId)
  if (!partner) return null

  return (
    <div className="not-prose my-6 [&>div]:justify-start">
      <PartnerImage
        alt={partner.name}
        className="h-16 w-auto max-w-64 object-contain object-left"
        config={partner.image}
      />
    </div>
  )
}

export function StartHostingLovableLogo() {
  return <StartHostingPartnerLogo partnerId="lovable" />
}

export function StartHostingRenderLogo() {
  return <StartHostingPartnerLogo partnerId="render" />
}

export function StartHostingVercelLogo() {
  return <StartHostingPartnerLogo partnerId="vercel" />
}

export function useStartHostingPartners() {
  const placementContext = usePartnerPlacementContext({
    category: 'deployment',
    orderStrategy: 'tier-rotated',
    surface: 'docs_strip',
  })
  const hostingPartners = React.useMemo(getStartHostingPartners, [])
  const groups = React.useMemo(
    () => getPartnerTierGroupsForPlacement(hostingPartners, placementContext),
    [hostingPartners, placementContext],
  )

  return { groups, placementContext }
}

export function StartHostingPartners() {
  const { groups, placementContext } = useStartHostingPartners()
  let slotIndex = 0

  return (
    <section
      aria-label="Official hosting partners"
      className="not-prose my-6 space-y-5"
    >
      {groups.map((group) => {
        const flare = partnerTierFlares[group.tier]

        return (
          <div key={group.tier}>
            <div className="mb-2 flex items-center gap-2">
              <span className={flare.iconColor}>{flare.icon}</span>
              <h3
                className={twMerge(
                  'text-xs font-bold uppercase tracking-[0.16em]',
                  flare.labelColor,
                )}
              >
                {partnerTierLabels[group.tier]} partners
              </h3>
              <div
                aria-hidden="true"
                className={twMerge(
                  'h-px flex-1 bg-linear-to-r from-current to-transparent opacity-35',
                  flare.iconColor,
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              {group.partners.map((partner) => {
                const index = slotIndex++

                return (
                  <StartHostingPartnerCard
                    key={partner.id}
                    index={index}
                    partner={partner}
                    placementContext={placementContext}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function StartHostingPartnerCard({
  index,
  partner,
  placementContext,
}: {
  index: number
  partner: (typeof partners)[number]
  placementContext: PartnerPlacementContext
}) {
  const analyticsMetadata = getPartnerPlacementAnalyticsMetadata(
    partner,
    placementContext,
  )
  const ref = useTrackedImpression<'partner_viewed', HTMLElement>({
    event: 'partner_viewed',
    props: {
      partner_id: partner.id,
      placement: 'docs_strip',
      ...analyticsMetadata,
      slot_index: index,
    },
  })
  const guideAnchor = startHostingGuideAnchors[partner.id]

  return (
    <article
      ref={ref}
      aria-label={`${partner.name} hosting partner`}
      className="relative flex min-h-40 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-gray-900"
    >
      <div
        aria-hidden="true"
        className={twMerge(
          'absolute inset-x-0 top-0 h-0.5 bg-linear-to-r',
          partnerTierFlares[analyticsMetadata.partner_tier].gradientStops,
        )}
      />
      <div className="flex h-10 items-center justify-start">
        <PartnerImage
          alt={partner.name}
          className="max-h-9 max-w-36 object-contain object-left"
          config={partner.image}
        />
      </div>
      {partner.tagline ? (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {partner.tagline}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 text-xs font-semibold">
        {guideAnchor ? (
          <a
            href={`#${guideAnchor}`}
            className="inline-flex items-center gap-1 text-lib-start no-underline hover:underline"
            onClick={() => {
              trackEvent('partner_clicked', {
                partner_id: partner.id,
                placement: 'docs_strip',
                destination: 'internal_resource',
                ...analyticsMetadata,
                slot_index: index,
              })
            }}
          >
            Setup guide
            <ArrowRightIcon className="size-3.5" />
          </a>
        ) : null}
        <a
          href={`/partners/${partner.id}`}
          className="text-gray-500 no-underline hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
          onClick={() => {
            trackEvent('partner_clicked', {
              partner_id: partner.id,
              placement: 'docs_strip',
              destination: 'internal_detail',
              ...analyticsMetadata,
              slot_index: index,
            })
          }}
        >
          Partner details
        </a>
      </div>
    </article>
  )
}
