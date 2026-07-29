import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { BrandAssetGallery } from '~/components/ds/BrandAssets'
import { DsPage } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/logos')({
  component: LogosPage,
  head: () => ({
    meta: seo({
      title: 'Logos | TanStack Design System',
      description:
        'Preview and download TanStack brand and social-media logo lockups.',
    }),
  }),
})

function LogosPage() {
  return (
    <DsPage
      title="Logos"
      description="Browse and download TanStack brand marks, favicons, and social-media artwork."
    >
      <BrandAssetGallery />
    </DsPage>
  )
}
