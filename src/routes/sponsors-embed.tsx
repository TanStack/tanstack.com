import SponsorPack from '~/components/SponsorPack'
import { getSponsorsForSponsorPack } from '~/server/sponsors'

const cacheHeaders = {
  'Cache-Control': 'max-age=300, s-maxage=3600, stale-while-revalidate',
}

export const Route = createFileRoute({
  staleTime: Infinity,
  loader: () => getSponsorsForSponsorPack(),
  headers: () => {
    // Cache the entire HTML response for 5 minutes
    return cacheHeaders
  },
  staticData: {
    baseParent: true,
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
        <SponsorPack sponsors={sponsors} />
      </div>
    </>
  )
}
