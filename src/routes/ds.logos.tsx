import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { CurrentBrandAssets } from '~/components/ds/BrandAssets'
import { DsPage } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/logos')({
  component: LogosPage,
  head: () => ({
    meta: seo({
      title: 'Logos | TanStack Design System',
      description:
        'Download the TanStack logo lockups — stacked and landscape, in every brand color.',
    }),
  }),
})

function LogosPage() {
  return (
    <DsPage
      title="Logos"
      description="The TanStack brand marks. Use the stacked lockup where vertical room allows and the landscape lockup for navbars and wide, short spaces. Pick the color that keeps the mark legible on its background — dark marks on light surfaces, light marks on dark. Every mark is an SVG; download the one you need below."
    >
      <CurrentBrandAssets />
    </DsPage>
  )
}
