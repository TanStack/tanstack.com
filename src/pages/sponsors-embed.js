import React from 'react'
import Head from 'next/head'
import 'twin.macro'
import SponsorPack from '../components/SponsorPack'
import { getSponsorsAndTiers } from '../server/sponsors'

export const getStaticProps = async () => {
  let { sponsors } = await getSponsorsAndTiers()

  sponsors = sponsors.filter((d) => d.privacyLevel === 'PUBLIC')

  return {
    props: JSON.parse(
      JSON.stringify({
        sponsors,
      })
    ),
    revalidate: 60, // In seconds
  }
}

export default function Sponsors({ sponsors }) {
  return (
    <>
      <Head>
        <base target="_parent" />
      </Head>
      <div tw="h-screen w-screen flex items-center justify-center overflow-hidden">
        <style
          dangerouslySetInnerHTML={{
            __html: `
        html, body {
          background: transparent;
        }
      `,
          }}
        />
        <SponsorPack sponsors={sponsors} />
      </div>
    </>
  )
}
