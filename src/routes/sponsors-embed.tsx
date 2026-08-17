import { createFileRoute } from '@tanstack/react-router'
import OssSponsors from '~/components/OssSponsors'
import { getOssSponsors } from '~/utils/sponsors.functions'

const cacheHeaders = {
  'Cache-Control': 'public, max-age=300',
  'Cloudflare-CDN-Cache-Control':
    'public, max-age=3600, stale-while-revalidate=300',
}

export const Route = createFileRoute('/sponsors-embed')({
  staleTime: Infinity,
  loader: () => getOssSponsors(),
  headers: () => {
    // Cache the entire HTML response for 5 minutes
    return cacheHeaders
  },
  staticData: {
    baseParent: true,
    showNavbar: false,
  },
  component: SponsorsEmbed,
})

function SponsorsEmbed() {
  const sponsors = Route.useLoaderData()

  return (
    <>
      <div
        className={`h-screen w-screen flex items-center justify-center overflow-hidden`}
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
        <OssSponsors sponsors={sponsors} />
      </div>
    </>
  )
}
