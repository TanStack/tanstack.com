import { createFileRoute } from '@tanstack/react-router'
import { partners } from '~/utils/partners'
import { PartnersGrid } from '~/components/PartnersGrid'

const cacheHeaders = {
  'Cache-Control': 'max-age=300, s-maxage=3600, stale-while-revalidate',
}

export const Route = createFileRoute('/partners-embed')({
  staleTime: Infinity,
  headers: () => {
    // Cache the entire HTML response for 5 minutes
    return cacheHeaders
  },
  staticData: {
    baseParent: true,
    showNavbar: false,
  },
  component: PartnersEmbed,
})

function PartnersEmbed() {
  const activePartners = partners.filter(
    (partner) => partner.status === 'active',
  )

  return (
    <>
      <div
        className={`min-h-screen w-screen flex items-start justify-center overflow-hidden`}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
  html, body {
    background: transparent !important;
  }
`,
          }}
        />
        <div className="px-4 w-full">
          <PartnersGrid partnersList={activePartners} />
        </div>
      </div>
    </>
  )
}
