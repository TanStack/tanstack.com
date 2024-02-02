import SponsorPack from '~/components/SponsorPack'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import { createFileRoute, createServerFn } from '@tanstack/react-router'

export const handle = {
  baseParent: true,
}

export const fetchSponsors = createServerFn('GET', async () => {
  'use server'
  return getSponsorsForSponsorPack()
})

export const Route = createFileRoute('/sponsors-embed')({
  loader: () => fetchSponsors(),
  headers: () => {
    return {
      'Cache-Control': 'max-age=300, s-maxage=3600, stale-while-revalidate',
    }
  },
})

export default function Sponsors() {
  const { sponsors } = Route.useLoaderData()

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
