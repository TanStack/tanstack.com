import { createFileRoute } from '@tanstack/react-router'
import { partners, partnerCategories, partnerCategoryLabels } from '~/utils/partners'
import {
  getPartnerPlacementContext,
  getPartnersForPlacement,
} from '~/utils/partner-placement'

export const Route = createFileRoute('/api/data/partners')({
  server: {
    handlers: {
      GET: async () => {
        const placementContext = getPartnerPlacementContext({
          orderStrategy: 'machine-readable',
          surface: 'api_data_partners',
        })
        const filteredPartners = getPartnersForPlacement(
          partners.filter((p) => p.status === 'active'),
          placementContext,
        )
          .map((p) => ({
            id: p.id,
            name: p.name,
            tagline: p.tagline,
            description: p.llmDescription,
            category: p.category,
            categoryLabel: partnerCategoryLabels[p.category],
            libraries: p.libraries || [],
            url: p.href,
          }))

        return new Response(
          JSON.stringify({
            partners: filteredPartners,
            categories: partnerCategories,
            categoryLabels: partnerCategoryLabels,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
            },
          },
        )
      },
    },
  },
})
