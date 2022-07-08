import SponsorPack from '../components/SponsorPack'
import { json, LoaderFunction, MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'

export const handle = {
  baseParent: true,
}

export const loader: LoaderFunction = async () => {
  const { getSponsorsForSponsorPack } = require('../server/sponsors')

  const sponsors = await getSponsorsForSponsorPack()

  return json(
    {
      sponsors,
    },
    {
      headers: {
        'Cache-Control': 'max-age=300, s-maxage=3600, stale-while-revalidate',
      },
    }
  )
}

export const ErrorBoundary = DefaultErrorBoundary

export const headers = ({ loaderHeaders }: { loaderHeaders: Headers }) => {
  return {
    'Cache-Control': loaderHeaders.get('Cache-Control') ?? '',
  }
}

export default function Sponsors() {
  const { sponsors } = useLoaderData()

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
