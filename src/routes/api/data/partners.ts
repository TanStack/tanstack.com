import { createFileRoute } from '@tanstack/react-router'
import { partners, partnerCategories, partnerCategoryLabels } from '~/utils/partners'

export const Route = createFileRoute('/api/data/partners')({
  server: {
    handlers: {
      GET: async () => {
        const filteredPartners = partners
          .filter((p) => p.status === 'active')
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
